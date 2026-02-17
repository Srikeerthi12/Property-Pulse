import React from 'react';
import SellerLeadAnalytics from '../../components/seller/SellerLeadAnalytics.jsx';

export default function SellerAnalytics() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Lead Analytics</h1>
        <p className="text-sm text-muted-foreground">Inquiry volume, conversion, and status breakdown.</p>
      </div>
      <SellerLeadAnalytics />
    </div>
  );
}
