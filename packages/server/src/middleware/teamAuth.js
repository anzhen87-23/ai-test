const db = require('../db');

const ROLES = { admin: 3, editor: 2, viewer: 1 };

const findMember = db.prepare(
  'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
);

/**
 * Returns the user's role in the team, or null if not a member.
 */
function getTeamRole(teamId, userId) {
  const member = findMember.get(teamId, userId);
  return member ? member.role : null;
}

/**
 * Koa middleware: require the user to be a team member with at least the given role.
 * Usage: requireTeamRole('admin')(ctx, next)
 */
function requireTeamRole(minRole) {
  return async (ctx, next) => {
    const teamId = Number(ctx.params.id || ctx.params.teamId);
    const userId = ctx.state.userId;
    const role = getTeamRole(teamId, userId);
    if (!role) {
      ctx.status = 403;
      ctx.body = { error: 'not a team member' };
      return;
    }
    if (ROLES[role] < ROLES[minRole]) {
      ctx.status = 403;
      ctx.body = { error: 'insufficient permissions' };
      return;
    }
    return next();
  };
}

/**
 * Check if a note belongs to a team and return the team_id.
 */
function getNoteTeamId(noteId) {
  const note = db.prepare('SELECT team_id FROM notes WHERE id = ?').get(noteId);
  return note ? note.team_id : null;
}

/**
 * Check if the user can access (read) a team note.
 * Returns the user's role if they have access, null otherwise.
 */
function checkTeamNoteAccess(noteId, userId) {
  const teamId = getNoteTeamId(noteId);
  if (!teamId) return null; // personal note, not team
  return getTeamRole(teamId, userId);
}

module.exports = { getTeamRole, requireTeamRole, getNoteTeamId, checkTeamNoteAccess, ROLES };
