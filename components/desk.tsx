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
        <div className="mb-6 border border-lacquer/30 bg-[#f8efe6] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-lacquer">Desk plan</p>
          <p className="mt-1 max-w-2xl text-sm leading-6">
            This desk stays locked on the Counter plan. Preview the unlock in Settings. Nothing here can send or connect.
          </p>
        </div>
      ) : (
        <div className="mb-6 border border-steady/30 bg-[#e7f0ea] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-steady">Desk · preview</p>
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
