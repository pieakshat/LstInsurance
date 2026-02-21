import { AdminWizard } from "./admin-wizard";

export default function AdminPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Admin — Deploy Insurance Policy</h1>
      <p className="text-neutral-400 text-sm mb-8">
        Walk through each step to register a protocol, deploy its vault, and wire permissions.
      </p>
      <AdminWizard />
    </div>
  );
}
