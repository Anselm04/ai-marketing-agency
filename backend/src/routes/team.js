import express from 'express';
import crypto from 'crypto';
import store from '../utils/store.js';
import { assertTeamSeatQuota } from '../services/planQuotaService.js';

const router = express.Router();

router.use((_req, res) => res.status(503).json({
  error: 'Team collaboration is not available until shared-workspace tenancy is production-ready.',
  code: 'team_collaboration_unavailable',
}));

async function getUserOrg(userId) {
  return store.getOrganizationByUserId(userId);
}

async function checkOrgRole(userId, orgId, allowedRoles) {
  const org = await store.getOrganizationById(orgId);
  if (!org) return false;
  const member = org.members.find(m => m.userId === userId);
  if (!member) return false;
  return allowedRoles.includes(member.role);
}

router.get('/org', async (req, res) => {
  try {
    const user = await store.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    let org = await getUserOrg(req.userId);
    if (!org) {
      org = await store.createOrganization({ name: `${user.email}'s Team`, ownerId: req.userId });
    }
    const users = await store.getUsers();
    const members = org.members.map(m => {
      const u = users.find(u => u.id === m.userId);
      return { userId: m.userId, role: m.role, email: u?.email, name: u?.profile?.firstName || u?.email };
    });
    res.json({ ...org, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/org', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!await checkOrgRole(req.userId, org.id, ['owner', 'admin'])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const updated = await store.updateOrganization(org.id, { name: req.body.name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/invites', async (req, res, next) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!await checkOrgRole(req.userId, org.id, ['owner', 'admin'])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const orgInvites = (await store.getInvites()).filter(
      (invite) => invite.orgId === org.id && new Date(invite.expiresAt) > new Date(),
    );
    await assertTeamSeatQuota(org.ownerId, org.members.length, orgInvites.length, 1);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const invite = await store.createInvite({
      orgId: org.id,
      email: req.body.email,
      role: req.body.role || 'member',
      token,
      expiresAt,
    });
    res.json({ invite, devToken: token });
  } catch (err) {
    next(err);
  }
});

router.post('/invites/accept', async (req, res, next) => {
  try {
    const invite = await store.findInviteByToken(req.body.token);
    if (!invite) return res.status(400).json({ error: 'Invalid or expired invite token' });
    const user = await store.findUserById(req.userId);
    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({ error: 'Invite email does not match' });
    }
    const org = await store.getOrganizationById(invite.orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    await assertTeamSeatQuota(org.ownerId, org.members.length, 0, 1);
    await store.addMember(invite.orgId, req.userId, invite.role);
    await store.deleteInvite(invite.id);
    res.json({ success: true, message: 'You have joined the organization.' });
  } catch (err) {
    next(err);
  }
});

router.get('/invites', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!await checkOrgRole(req.userId, org.id, ['owner', 'admin'])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const orgInvites = (await store.getInvites()).filter(i => i.orgId === org.id && new Date(i.expiresAt) > new Date());
    res.json(orgInvites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/members/:userId', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!await checkOrgRole(req.userId, org.id, ['owner', 'admin'])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (req.params.userId === org.ownerId) {
      return res.status(403).json({ error: 'Cannot remove owner' });
    }
    await store.removeMember(org.id, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
