export function DeskGate({
  locked,
  notice,
  children,
}: {
  locked: boolean;
  notice?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {locked ? (
        <div className="mb-6 border-l-4 border-lacquer pl-4">
          <p className="font-mono text-[11px] text-lacquer">Pro plan</p>
          <p className="mt-1 max-w-2xl text-sm leading-6">
            Pro is the paid plan. Free can look. Only Pro can save a rule or open this door.
          </p>
        </div>
      ) : (
        <div className="mb-6 border-l-4 border-steady pl-4">
          <p className="font-mono text-[11px] text-steady">Pro</p>
          <p className="mt-1 max-w-2xl text-sm leading-6">
            Pro is on for this book. Rules can be saved. Mail leaves once a host is saved. The MCP server is not answering yet.
          </p>
        </div>
      )}
      {notice === "held" ? (
        <p className="mb-6 text-sm text-lacquer">Held. This desk is drawn, not connected.</p>
      ) : null}
      {children}
    </div>
  );
}
