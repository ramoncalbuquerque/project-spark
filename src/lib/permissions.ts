export type UserRole = 'master' | 'leader' | 'member';

export function canCreate(_role: UserRole): boolean {
  return true;
}

export function canCreateProject(role: UserRole): boolean {
  return role === 'master' || role === 'leader';
}

export function canCreateRitual(role: UserRole): boolean {
  return role === 'master' || role === 'leader';
}

export function canManagePeople(role: UserRole): boolean {
  return role === 'master' || role === 'leader';
}

export function canChangeRoles(role: UserRole): boolean {
  return role === 'master';
}

export function canEditCard(role: UserRole, isCreator: boolean, isAssignee: boolean): boolean {
  if (role === 'master') return true;
  if (isCreator) return true;
  if (role === 'leader') return true;
  if (isAssignee) return true;
  return false;
}

export function canDeleteCard(role: UserRole, isCreator: boolean): boolean {
  if (role === 'master') return true;
  if (isCreator) return true;
  if (role === 'leader') return true;
  return false;
}

export function canManageTeams(role: UserRole): boolean {
  return role === 'master' || role === 'leader';
}
