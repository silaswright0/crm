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
          <p className="font-mono text-[11px] text-lacquer">Desk plan</p>
          <p className="mt-1 max-w-2xl text-sm leading-6">
            This desk stays locked on the Counter plan. Preview the unlock in Settings. Nothing here can send or connect.
          </p>
        </div>
      ) : (
        <div className="mb-6 border-l-4 border-steady pl-4">
          <p className="font-mono text-[11px] text-steady">Desk, preview</p>
          <p className="mt-1 max-w-2xl text-sm leading-6">
            The lock is off so you can see the desk. Sending and the agent door are still not live.
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
