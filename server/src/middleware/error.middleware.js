// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, _req, res, _next) {
  const isUploadError =
    err?.name === 'MulterError' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('image'));
  const status = err?.status || (isUploadError ? 400 : 500);
  const message = err?.message || 'Internal Server Error';
  res.status(status).json({ error: message });
}
