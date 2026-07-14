import { useMemo } from "react";
import { Users, UserCheck } from "lucide-react";
import { usePMOStore } from "@/store/pmoStore";
import type { TeamAssignment } from "@/types";

interface Props {
  tim: TeamAssignment;
}

const ROLES = ["Product Manager", "BSM", "BPA", "UI/UX", "DEV", "PQA", "ABAP"] as const;

export default function TeamDisplay({ tim }: Props) {
  const allMembers = usePMOStore((s) => s.teamMembers);

  const totalUnique = useMemo(() => {
    const ids = new Set<string>();
    for (const ids_arr of Object.values(tim)) {
      ids_arr.forEach((id: string) => ids.add(id));
    }
    return ids.size;
  }, [tim]);

  return (
    <div className="bg-canvas rounded-xl border border-hairline-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Users size={18} className="text-slate" />
          <h2 className="text-base font-medium text-ink">Team</h2>
          <span className="text-xs text-stone bg-surface px-2 py-0.5 rounded-full">
            {totalUnique} member{totalUnique !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {ROLES.map((role) => {
          const memberIds = tim[role] ?? [];
          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="text-xs font-semibold text-steel uppercase tracking-wide">{role}</h4>
                <span className="text-[10px] text-stone bg-surface px-1.5 py-0.5 rounded-full">
                  {memberIds.length}
                </span>
              </div>
              {memberIds.length === 0 ? (
                <p className="text-sm text-stone italic pl-1">Belum ada</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {memberIds.map((id) => (
                    <MemberChip key={id} memberId={id} allMembers={allMembers} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MemberChip({
  memberId,
  allMembers,
}: {
  memberId: string;
  allMembers: ReturnType<typeof usePMOStore.getState>["teamMembers"];
}) {
  const member = useMemo(
    () => allMembers.find((m) => m.id === memberId),
    [allMembers, memberId]
  );
  const getWorkload = usePMOStore((s) => s.getMemberWorkload);
  const workload = getWorkload(memberId);

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface rounded-full text-xs font-medium text-ink">
      <UserCheck size={12} className="text-stone" />
      {member?.nama ?? memberId}
      {workload > 0 && (
        <span
          className={`text-[10px] font-medium px-1 py-0 rounded-full ${
            workload >= 3 ? "bg-amber-50 text-amber-700" : "text-stone"
          }`}
          title={`${workload} active project${workload !== 1 ? "s" : ""}`}
        >
          {workload}p
        </span>
      )}
    </span>
  );
}
