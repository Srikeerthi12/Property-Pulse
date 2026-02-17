import fs from 'node:fs/promises';
import path from 'node:path';

import { createPropertySchema, listApprovedSchema, updatePropertySchema } from '../utils/property.validators.js';
import {
  createProperty,
  getPropertyByIdMapped,
  hasActiveDeal,
  incrementPropertyViewCount,
  listApprovedProperties,
  listSellerProperties,
  setPropertyStatus,
  updatePropertyById,
} from '../models/property.model.js';
import {
  addPropertyImages,
  deleteAllImagesForProperty,
  deletePropertyImageById,
  getPropertyImageById,
  listPropertyImages,
} from '../models/propertyImage.model.js';
import { listPropertyLogs, logPropertyAction } from '../models/propertyLog.model.js';
import { ensurePropertyUploadsDir, getUploadsRoot, isWithinUploadsRoot } from '../config/uploads.js';
import { findUserById } from '../models/user.model.js';

function getActor(req) {
  return req.auth?.sub || null;
}

function canCreateProperty(role) {
  const r = (role ?? '').toString().toLowerCase();
  return r === 'seller' || r === 'agent';
}

function canManageProperty(req, property) {
  const role = (req.user?.role ?? '').toString().toLowerCase();
  if (role === 'admin') return true;
  return property?.sellerId && req.auth?.sub && property.sellerId === req.auth.sub;
}

function uploadUrlToAbsPath(uploadUrl) {
  if (!uploadUrl || typeof uploadUrl !== 'string') return null;
  const root = getUploadsRoot();
  const rel = uploadUrl.replace(/^\/uploads\//, '');
  return path.join(root, ...rel.split('/'));
}

export async function listApproved(req, res) {
  const parsed = listApprovedSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });
  }

  const items = await listApprovedProperties(parsed.data);
  return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
}

export async function listMine(req, res) {
  const role = (req.user?.role ?? '').toString().toLowerCase();
  if (!canCreateProperty(role)) return res.status(403).json({ error: 'Forbidden' });

  const items = await listSellerProperties(req.auth.sub);
  return res.json({ items });
}

export async function getById(req, res) {
  const property = await getPropertyByIdMapped(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const isApproved = property.status === 'approved';
  const isOwnerOrAdmin = req.auth?.sub ? canManageProperty(req, property) : false;

  if (!isApproved && !isOwnerOrAdmin) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const images = await listPropertyImages(property.id);

  const seller = property.sellerId ? await findUserById(property.sellerId) : null;
  const sellerBasic = seller ? { id: seller.id, name: seller.name, role: seller.role } : null;

  return res.json({ property: { ...property, images, seller: sellerBasic } });
}

export async function trackView(req, res) {
  const property = await getPropertyByIdMapped(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const isApproved = property.status === 'approved';
  if (!isApproved) return res.json({ ok: true, tracked: false });

  const role = (req.user?.role ?? '').toString().toLowerCase();
  const viewerId = req.auth?.sub ?? null;
  const isOwner = viewerId && property.sellerId && viewerId === property.sellerId;
  const isAdmin = role === 'admin';
  if (isOwner || isAdmin) return res.json({ ok: true, tracked: false });

  await incrementPropertyViewCount(property.id);
  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_VIEWED',
    performedBy: viewerId,
    metadata: { viewer: viewerId ? 'user' : 'anonymous' },
  });

  return res.json({ ok: true, tracked: true });
}

export async function create(req, res) {
  const role = (req.user?.role ?? '').toString().toLowerCase();
  if (!canCreateProperty(role)) return res.status(403).json({ error: 'Forbidden' });

  const parsed = createPropertySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const status = parsed.data.submit ? 'pending' : 'draft';

  const created = await createProperty({
    sellerId: req.auth.sub,
    title: parsed.data.title,
    description: parsed.data.description,
    price: parsed.data.price,
    area: parsed.data.area,
    location: parsed.data.location,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    propertyType: parsed.data.propertyType,
    bedrooms: parsed.data.bedrooms,
    bathrooms: parsed.data.bathrooms,
    amenities: parsed.data.amenities ?? [],
    status,
  });

  const files = Array.isArray(req.files) ? req.files : [];
  const urls = [];
  if (files.length > 0) {
    const destDir = ensurePropertyUploadsDir(created.id);
    for (const file of files) {
      const currentPath = file.path;
      const destPath = path.join(destDir, path.basename(currentPath));
      if (currentPath !== destPath) {
        try {
          await fs.rename(currentPath, destPath);
        } catch {
          // ignore
        }
      }
      urls.push(`/uploads/properties/${created.id}/${path.basename(destPath)}`);
    }
  }

  const images = await addPropertyImages(created.id, urls);

  await logPropertyAction({
    propertyId: created.id,
    actionType: 'PROPERTY_CREATED',
    performedBy: getActor(req),
    metadata: { status, imagesAdded: images.length },
  });

  return res.status(201).json({ property: { ...created, images } });
}

export async function update(req, res) {
  const property = await getPropertyByIdMapped(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  if (!canManageProperty(req, property)) return res.status(403).json({ error: 'Forbidden' });
  if (property.status === 'sold') return res.status(409).json({ error: 'Sold properties cannot be edited' });
  if (!['draft', 'rejected'].includes(property.status)) {
    return res.status(409).json({ error: 'Only draft/rejected properties can be edited' });
  }

  const parsed = updatePropertySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const updated = await updatePropertyById(property.id, {
    ...parsed.data,
    propertyType: parsed.data.propertyType,
  });

  const files = Array.isArray(req.files) ? req.files : [];
  let newImages = [];
  if (files.length > 0) {
    const destDir = ensurePropertyUploadsDir(property.id);
    const urls = [];
    for (const file of files) {
      const currentPath = file.path;
      const destPath = path.join(destDir, path.basename(currentPath));
      if (currentPath !== destPath) {
        try {
          await fs.rename(currentPath, destPath);
        } catch {
          // ignore
        }
      }
      urls.push(`/uploads/properties/${property.id}/${path.basename(destPath)}`);
    }
    newImages = await addPropertyImages(property.id, urls);
  }

  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_UPDATED',
    performedBy: getActor(req),
    metadata: { imagesAdded: newImages.length },
  });

  const images = await listPropertyImages(property.id);
  return res.json({ property: { ...updated, images } });
}

export async function logs(req, res) {
  const property = await getPropertyByIdMapped(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (!canManageProperty(req, property)) return res.status(403).json({ error: 'Forbidden' });

  const items = await listPropertyLogs(property.id);
  return res.json({ logs: items });
}

export async function submitForApproval(req, res) {
  const property = await getPropertyByIdMapped(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (!canManageProperty(req, property)) return res.status(403).json({ error: 'Forbidden' });

  if (!['draft', 'rejected'].includes(property.status)) {
    return res.status(409).json({ error: 'Only draft/rejected properties can be submitted' });
  }

  const updated = await setPropertyStatus({ propertyId: property.id, status: 'pending', rejectionReason: null });
  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_SUBMITTED',
    performedBy: getActor(req),
    metadata: { from: property.status, to: 'pending' },
  });

  const images = await listPropertyImages(property.id);
  return res.json({ property: { ...updated, images } });
}

export async function markInactive(req, res) {
  const property = await getPropertyByIdMapped(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (!canManageProperty(req, property)) return res.status(403).json({ error: 'Forbidden' });
  if (property.status === 'sold') return res.status(409).json({ error: 'Sold properties cannot be deactivated' });

  const updated = await setPropertyStatus({ propertyId: property.id, status: 'inactive', rejectionReason: null });
  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_INACTIVATED',
    performedBy: getActor(req),
  });

  const images = await listPropertyImages(property.id);
  return res.json({ property: { ...updated, images } });
}

export async function deleteImage(req, res) {
  const property = await getPropertyByIdMapped(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (!canManageProperty(req, property)) return res.status(403).json({ error: 'Forbidden' });

  const image = await getPropertyImageById(req.params.imageId);
  if (!image || image.propertyId !== property.id) return res.status(404).json({ error: 'Image not found' });

  const abs = uploadUrlToAbsPath(image.imageUrl);
  if (abs && isWithinUploadsRoot(abs)) {
    try {
      await fs.unlink(abs);
    } catch {
      // ignore
    }
  }

  await deletePropertyImageById(image.id);
  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_IMAGE_DELETED',
    performedBy: getActor(req),
    metadata: { imageId: image.id },
  });

  return res.json({ ok: true });
}

export async function remove(req, res) {
  const property = await getPropertyByIdMapped(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (!canManageProperty(req, property)) return res.status(403).json({ error: 'Forbidden' });

  const activeDeal = await hasActiveDeal(property.id);
  if (activeDeal) return res.status(409).json({ error: 'Cannot delete property with an active deal' });

  await setPropertyStatus({ propertyId: property.id, status: 'inactive', rejectionReason: null });

  const removed = await deleteAllImagesForProperty(property.id);
  for (const row of removed) {
    const abs = uploadUrlToAbsPath(row.imageUrl);
    if (abs && isWithinUploadsRoot(abs)) {
      try {
        await fs.unlink(abs);
      } catch {
        // ignore
      }
    }
  }

  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_DELETED',
    performedBy: getActor(req),
  });

  return res.json({ ok: true });
}
