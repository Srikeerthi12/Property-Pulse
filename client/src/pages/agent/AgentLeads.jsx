import React from 'react';
import AgentLeadsBoard from '../../components/agent/AgentLeadsBoard.jsx';

export default function AgentLeads() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Leads</h1>
        <p className="text-sm text-muted-foreground">Manage and progress your lead pipeline.</p>
      </div>
      <AgentLeadsBoard />
    </div>
  );
}
