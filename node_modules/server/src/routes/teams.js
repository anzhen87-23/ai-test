const Router = require('@koa/router');
const db = require('../db');
const { getTeamRole, requireTeamRole } = require('../middleware/teamAuth');

const router = new Router({ prefix: '/api/teams' });

// ── Prepared Statements ──
const listTeams = db.prepare(`
  SELECT t.id, t.name, t.creator_user_id, t.created_at, t.updated_at, tm.role
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  WHERE tm.user_id = ?
  ORDER BY t.updated_at DESC
`);

const findById = db.prepare('SELECT * FROM teams WHERE id = ?');
const findMember = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?');
const findUserByEmail = db.prepare('SELECT id, email FROM users WHERE email = ?');

const insertTeam = db.prepare('INSERT INTO teams (name, creator_user_id) VALUES (?, ?)');
const updateTeam = db.prepare('UPDATE teams SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
const deleteTeam = db.prepare('DELETE FROM teams WHERE id = ?');

const insertMember = db.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)');
const updateMemberRole = db.prepare('UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?');
const deleteMember = db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?');
const listMembers = db.prepare(`
  SELECT u.id, u.email, tm.role
  FROM team_members tm
  JOIN users u ON u.id = tm.user_id
  WHERE tm.team_id = ?
  ORDER BY tm.joined_at ASC
`);

// ── List user's teams ──
router.get('/', async (ctx) => {
  try {
    const teams = listTeams.all(ctx.state.userId);
    ctx.body = { teams };
  } catch (err) {
    console.error('Error listing teams:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Create team ──
router.post('/', async (ctx) => {
  try {
    const { name } = ctx.request.body;
    if (!name || !name.trim()) {
      ctx.status = 400;
      ctx.body = { error: 'team name is required' };
      return;
    }
    const result = insertTeam.run(name.trim(), ctx.state.userId);
    const teamId = Number(result.lastInsertRowid);
    // Creator becomes admin
    insertMember.run(teamId, ctx.state.userId, 'admin');
    const team = findById.get(teamId);
    ctx.status = 201;
    ctx.body = { team };
  } catch (err) {
    console.error('Error creating team:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Get team details ──
router.get('/:id', requireTeamRole('viewer'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const team = findById.get(teamId);
    if (!team) {
      ctx.status = 404;
      ctx.body = { error: 'team not found' };
      return;
    }
    const members = listMembers.all(teamId);
    ctx.body = { team, members };
  } catch (err) {
    console.error('Error getting team:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Update team (admin only) ──
router.put('/:id', requireTeamRole('admin'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const { name } = ctx.request.body;
    if (!name || !name.trim()) {
      ctx.status = 400;
      ctx.body = { error: 'team name is required' };
      return;
    }
    updateTeam.run(name.trim(), teamId);
    const team = findById.get(teamId);
    ctx.body = { team };
  } catch (err) {
    console.error('Error updating team:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Delete team (admin only) ──
router.delete('/:id', requireTeamRole('admin'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const result = deleteTeam.run(teamId);
    if (result.changes === 0) {
      ctx.status = 404;
      ctx.body = { error: 'team not found' };
      return;
    }
    ctx.status = 204;
  } catch (err) {
    console.error('Error deleting team:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── List team members ──
router.get('/:id/members', requireTeamRole('viewer'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const members = listMembers.all(teamId);
    ctx.body = { members };
  } catch (err) {
    console.error('Error listing members:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Add member by email (admin only) ──
router.post('/:id/members', requireTeamRole('admin'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const { email, role } = ctx.request.body;
    if (!email) {
      ctx.status = 400;
      ctx.body = { error: 'email is required' };
      return;
    }
    const userRole = role || 'viewer';
    if (!['admin', 'editor', 'viewer'].includes(userRole)) {
      ctx.status = 400;
      ctx.body = { error: 'invalid role. must be admin, editor, or viewer' };
      return;
    }
    const user = findUserByEmail.get(email.trim());
    if (!user) {
      ctx.status = 404;
      ctx.body = { error: 'user not found. user must be registered first' };
      return;
    }
    const existing = findMember.get(teamId, user.id);
    if (existing) {
      ctx.status = 409;
      ctx.body = { error: 'user is already a member of this team' };
      return;
    }
    insertMember.run(teamId, user.id, userRole);
    ctx.status = 201;
    ctx.body = { member: { user_id: user.id, email: user.email, role: userRole } };
  } catch (err) {
    console.error('Error adding member:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Update member role (admin only) ──
router.put('/:id/members/:userId', requireTeamRole('admin'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const userId = Number(ctx.params.userId);
    const { role } = ctx.request.body;
    if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
      ctx.status = 400;
      ctx.body = { error: 'valid role is required' };
      return;
    }
    const existing = findMember.get(teamId, userId);
    if (!existing) {
      ctx.status = 404;
      ctx.body = { error: 'member not found' };
      return;
    }
    updateMemberRole.run(role, teamId, userId);
    const member = findMember.get(teamId, userId);
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    ctx.body = { member: { user_id: userId, email: user.email, role: member.role } };
  } catch (err) {
    console.error('Error updating member role:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Remove member (admin only) ──
router.delete('/:id/members/:userId', requireTeamRole('admin'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const userId = Number(ctx.params.userId);
    // Prevent admin from removing themselves
    if (userId === ctx.state.userId) {
      ctx.status = 400;
      ctx.body = { error: 'cannot remove yourself from the team' };
      return;
    }
    const result = deleteMember.run(teamId, userId);
    if (result.changes === 0) {
      ctx.status = 404;
      ctx.body = { error: 'member not found' };
      return;
    }
    ctx.status = 204;
  } catch (err) {
    console.error('Error removing member:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

module.exports = router;
