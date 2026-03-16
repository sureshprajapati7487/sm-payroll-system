import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useWorkGroupStore,
  GROUP_COLOR_MAP,
  WorkGroup,
} from "@/store/workGroupStore";
import { useEmployeeStore } from "@/store/employeeStore";
import { EmployeeStatus } from "@/types";
import {
  X,
  Plus,
  Trash2,
  Users,
  Layers,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { clsx } from "clsx";

interface Props {
  onClose?: () => void;
}

export const WorkGroupManager = ({ onClose }: Props) => {
  const navigate = useNavigate();
  const handleClose = () => (onClose ? onClose() : navigate(-1));
  const {
    groups,
    assignments,
    addGroup,
    removeGroup,
    assignEmployee,
    unassignEmployee,
  } = useWorkGroupStore();
  const { employees } = useEmployeeStore();

  const activeEmployees = employees.filter(
    (e) => e.status === EmployeeStatus.ACTIVE,
  );

  // Unique departments from employees
  const departments = useMemo(() => {
    const s = new Set<string>();
    activeEmployees.forEach((e) => {
      if (e.department) s.add(e.department);
    });
    return Array.from(s).sort();
  }, [activeEmployees]);

  // New group form — simple: just name + parent dept
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState(departments[0] || "");

  const [assigningGroupId, setAssigningGroupId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    addGroup({
      name: newName.trim(),
      department: newDept || "General",
      color: "blue",
      icon: "",
    });
    setNewName("");
  };

  // Groups by department
  const groupsByDept = useMemo(() => {
    const map = new Map<string, WorkGroup[]>();
    groups.forEach((g) => {
      if (!map.has(g.department)) map.set(g.department, []);
      map.get(g.department)!.push(g);
    });
    return map;
  }, [groups]);

  const getEmpOptions = (group: WorkGroup) =>
    activeEmployees.filter(
      (e) =>
        (e.department === group.department || !e.department) &&
        assignments[e.id] !== group.id &&
        (e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
          e.code.toLowerCase().includes(empSearch.toLowerCase())),
    );

  const getGroupMembers = (group: WorkGroup) =>
    activeEmployees.filter((e) => assignments[e.id] === group.id);

  const totalAssigned = Object.keys(assignments).length;
  const totalUnassigned = activeEmployees.length - totalAssigned;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Work Allocation Manager
          </h1>
          <p className="text-dark-muted mt-1">
            {groups.length} departments · {totalAssigned} assigned ·{" "}
            {totalUnassigned} unassigned
          </p>
        </div>
        <button
          onClick={handleClose}
          className="text-dark-muted hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="glass rounded-2xl overflow-hidden mt-4 shadow-xl">
        <div className="flex flex-col md:flex-row h-auto md:h-[75vh]">
          {/* LEFT: Create + Department List */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-dark-border flex flex-col bg-dark-bg/20 shrink-0 min-h-[300px] md:min-h-0">
            {/* Create new department */}
            <div className="p-4 border-b border-dark-border bg-dark-bg/30">
              <p className="text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-3">
                Add Department
              </p>
              <div className="space-y-2">
                {/* Name */}
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="e.g. Cutting Department"
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-white text-sm focus:border-primary-500 focus:outline-none"
                />

                {/* Under Dept */}
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-primary-500 focus:outline-none"
                >
                  <option value="">-- Under Dept (optional) --</option>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>

                <button
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className={clsx(
                    "w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                    newName.trim()
                      ? "bg-violet-600 hover:bg-violet-500 text-white"
                      : "bg-dark-bg text-dark-muted border border-dark-border cursor-not-allowed",
                  )}
                >
                  <Plus className="w-4 h-4" /> Add Department
                </button>
              </div>
            </div>

            {/* Departments list */}
            <div className="flex-1 overflow-auto p-2 space-y-2">
              {departments.map((dept) => {
                const deptGroups = groupsByDept.get(dept) || [];
                if (deptGroups.length === 0) return null;
                return (
                  <div key={dept}>
                    <p className="text-[9px] font-bold text-dark-muted uppercase tracking-widest px-2 py-1">
                      {dept}
                    </p>
                    {deptGroups.map((g) => {
                      const col =
                        GROUP_COLOR_MAP[g.color] || GROUP_COLOR_MAP.blue;
                      const members = getGroupMembers(g);
                      const isActive = assigningGroupId === g.id;
                      return (
                        <div
                          key={g.id}
                          onClick={() =>
                            setAssigningGroupId(isActive ? null : g.id)
                          }
                          className={clsx(
                            "flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all mb-1 group",
                            isActive
                              ? `${col.bg} ${col.border} border`
                              : "hover:bg-dark-bg/50",
                          )}
                        >
                          <div
                            className={clsx(
                              "w-2 h-2 rounded-full",
                              col.bg,
                              col.border,
                              "border",
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={clsx(
                                "text-sm font-medium truncate",
                                isActive ? col.text : "text-white",
                              )}
                            >
                              {g.name}
                            </p>
                            <p className="text-[10px] text-dark-muted">
                              {members.length} employees
                            </p>
                          </div>
                          {/* Delete */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  `"${g.name}" delete karna chahte ho?`,
                                )
                              )
                                removeGroup(g.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-dark-muted hover:text-danger p-1 rounded transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {/* Groups not under any employee dept */}
              {Array.from(groupsByDept.entries())
                .filter(([dept]) => !departments.includes(dept))
                .map(([dept, deptGroups]) => (
                  <div key={dept}>
                    <p className="text-[9px] font-bold text-dark-muted uppercase tracking-widest px-2 py-1">
                      {dept || "General"}
                    </p>
                    {deptGroups.map((g) => {
                      const members = getGroupMembers(g);
                      const isActive = assigningGroupId === g.id;
                      return (
                        <div
                          key={g.id}
                          onClick={() =>
                            setAssigningGroupId(isActive ? null : g.id)
                          }
                          className={clsx(
                            "flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all mb-1 group",
                            isActive
                              ? "bg-violet-500/10 border border-violet-500/30"
                              : "hover:bg-dark-bg/50",
                          )}
                        >
                          <div className="w-2 h-2 rounded-full bg-violet-500/30 border border-violet-500" />
                          <div className="flex-1 min-w-0">
                            <p
                              className={clsx(
                                "text-sm font-medium truncate",
                                isActive ? "text-violet-400" : "text-white",
                              )}
                            >
                              {g.name}
                            </p>
                            <p className="text-[10px] text-dark-muted">
                              {members.length} employees
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`"${g.name}" delete karein?`))
                                removeGroup(g.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-dark-muted hover:text-danger p-1 rounded transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              {groups.length === 0 && (
                <div className="text-center text-dark-muted opacity-50 py-8">
                  <Layers className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs">Koi department nahi hai abhi</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Employee Assignment */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-[400px] md:min-h-0 bg-dark-bg/10">
            {assigningGroupId ? (
              (() => {
                const group = groups.find((g) => g.id === assigningGroupId)!;
                if (!group) return null;
                const col =
                  GROUP_COLOR_MAP[group.color] || GROUP_COLOR_MAP.blue;
                const members = getGroupMembers(group);
                const options = getEmpOptions(group);

                return (
                  <>
                    <div
                      className={clsx(
                        "px-4 py-3 md:px-5 md:py-4 border-b border-dark-border flex flex-col sm:flex-row sm:items-center gap-3",
                        col.bg,
                      )}
                    >
                      <div className="flex-1">
                        <h3
                          className={clsx(
                            "font-bold text-base md:text-lg",
                            col.text,
                          )}
                        >
                          {group.name}
                        </h3>
                        <p className="text-[10px] md:text-xs text-dark-muted font-medium">
                          {group.department} · {members.length} assigned
                        </p>
                      </div>
                      <div className="w-full sm:w-auto">
                        <input
                          type="text"
                          placeholder="Search employee..."
                          value={empSearch}
                          onChange={(e) => setEmpSearch(e.target.value)}
                          className="bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-1.5 text-white text-xs md:text-sm focus:outline-none focus:border-primary-500 w-full sm:w-56 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 md:p-5 space-y-6">
                      {/* Current members */}
                      {members.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Assigned (
                            {members.length})
                          </p>
                          <div className="space-y-1">
                            {members.map((emp) => (
                              <div
                                key={emp.id}
                                className={clsx(
                                  "flex items-center gap-3 px-3 py-2 rounded-lg",
                                  col.bg,
                                )}
                              >
                                <div
                                  className={clsx(
                                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                                    col.badge,
                                  )}
                                >
                                  {emp.name[0]}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-white font-medium">
                                    {emp.name}
                                  </p>
                                  <p className="text-[10px] text-dark-muted">
                                    {emp.code} · {emp.designation || "—"}
                                  </p>
                                </div>
                                <button
                                  onClick={() => unassignEmployee(emp.id)}
                                  className="text-dark-muted hover:text-danger flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-danger/10 transition-all"
                                >
                                  <UserMinus className="w-3 h-3" /> Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available employees */}
                      {options.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                            <UserPlus className="w-3 h-3" /> Add from{" "}
                            {group.department} ({options.length})
                          </p>
                          <div className="space-y-1">
                            {options.map((emp) => (
                              <div
                                key={emp.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-bg/60 transition-colors group"
                              >
                                <div className="w-7 h-7 rounded-full bg-dark-bg flex items-center justify-center text-xs font-bold text-dark-muted">
                                  {emp.name[0]}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-white">
                                    {emp.name}
                                  </p>
                                  <p className="text-[10px] text-dark-muted">
                                    {emp.code} · {emp.designation || "—"}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    assignEmployee(emp.id, group.id)
                                  }
                                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-emerald-400 hover:bg-emerald-500/10 px-2 py-1 rounded transition-all"
                                >
                                  <UserPlus className="w-3 h-3" /> Add
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {members.length === 0 && options.length === 0 && (
                        <div className="text-center text-dark-muted opacity-50 py-12">
                          <Users className="w-10 h-10 mx-auto mb-2" />
                          <p className="text-sm">
                            Is department mein aur employees nahi
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-dark-muted opacity-40">
                <Layers className="w-14 h-14 mb-3" />
                <p className="text-sm font-medium">
                  Left se koi department select karo
                </p>
                <p className="text-xs mt-1">
                  Employees assign/remove karne ke liye
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
