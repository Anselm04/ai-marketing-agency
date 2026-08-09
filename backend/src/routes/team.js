import express from 'express';
import crypto from 'crypto';
import store from '../utils/store.js';
import { validateBody } from '../middleware/validate.js';
import { sendTeamInvite } from '../services/emailService.js';

const router = express.Router();

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

// Get current user's organization
router.get('/org', async (req, res) => {
  try {
    const user = await store.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let org = await getUserOrg(req.userId);
    if (!org) {
      // Auto-create org for first-time users
      org = await store.createOrganization({ name: `${user.email}'s Team`, ownerId: req.userId });
    }

    const users = await store.getUsers();
    const members = org.members.map(m => {
      const u = users.find(u => u.id === m.userId);
      return { userId: m.userId, role: m.role, email: u?.email, name: u?.profile?.firstName || u?.email, joinedAt: m.joinedAt };
    });

    res.json({ ...org, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update organization name
router.patch('/org',
  validateBody({ name: { required: true, type: 'string', minLength: 1 } }),
  async (req, res) => {
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
  }
);

// Create invite
router.post('/invites',
  validateBody({ email: { required: true, type: 'string', minLength: 5 }, role: { required: false, type: 'string' } }),
  async (req, res) => {
    try {
      const org = await getUserOrg(req.userId);
      if (!org) return res.status(404).json({ error: 'Organization not found' });
      if (!await checkOrgRole(req.userId, org.id, ['owner', 'admin'])) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const existing = await store.findUserByEmail(req.body.email.toLowerCase());
      if (existing && org.members.some(m => m.userId === existing.id)) {
        return res.status(409).json({ error: 'User already in organization' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const invite = await store.createInvite({
        orgId: org.id,
        email: req.body.email,
        role: req.body.role || 'member',
        token,
        expiresAt,
      });

      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/team/invite?token=${token}`;
      const inviter = await store.findUserById(req.userId);
      await sendTeamInvite(req.body.email, org.name, inviteUrl, inviter?.profile?.firstName || inviter?.email || 'A team member');

      res.json({ invite, devToken: token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Accept invite
router.post('/invites/accept',
  validateBody({ token: { required: true, type: 'string' } }),
  async (req, res) => {
    try {
      const invite = await store.findInviteByToken(req.body.token);
      if (!invite) return res.status(400).json({ error: 'Invalid or expired invite token' });

      const user = await store.findUserById(req.userId);
      if (user.email.toLowerCase() !== invite.email) {
        return res.status(403).json({ error: 'Invite email does not match your account' });
      }

      await store.addMember(invite.orgId, req.userId, invite.role);
      await store.deleteInvite(invite.id);
      res.json({ success: true, message: 'You have joined the organization.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// List invites for org
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

// Update member role
router.patch('/members/:userId',
  validateBody({ role: { required: true, type: 'string' } }),
  async (req, res) => {
    try {
      const org = await getUserOrg(req.userId);
      if (!org) return res.status(404).json({ error: 'Organization not found' });
      if (!await checkOrgRole(req.userId, org.id, ['owner'])) {
        return res.status(403).json({ error: 'Only owners can change roles' });
      }
      const updated = await store.updateMemberRole(org.id, req.params.userId, req.body.role);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Remove member
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
