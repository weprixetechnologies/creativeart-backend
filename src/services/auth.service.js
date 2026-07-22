const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const UserModel = require('../models/user.model');
const RefreshTokenModel = require('../models/refresh-token.model');
const { AuthenticationError, ConflictError, NotFoundError } = require('../utils/errors');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

class AuthService {
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static generateAccessToken(user) {
    return jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026',
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  static generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  static async register({ name, email, phone, password, role }) {
    if (!email && !phone) {
      throw new ConflictError('Either email or phone must be provided.');
    }

    if (email) {
      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) throw new ConflictError('Email is already registered.');
    }

    if (phone) {
      const existingPhone = await UserModel.findByPhone(phone);
      if (existingPhone) throw new ConflictError('Phone is already registered.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      name,
      email,
      phone,
      passwordHash,
      role: role || 'CUSTOMER'
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    };
  }

  static async login({ email, phone, password }) {
    let user = null;
    if (email) {
      user = await UserModel.findByEmail(email);
    } else if (phone) {
      user = await UserModel.findByPhone(phone);
    }

    if (!user) {
      throw new AuthenticationError('Invalid email/phone or password.');
    }

    if (user.status === 'DEACTIVATED') {
      throw new AuthenticationError('Your account has been deactivated.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AuthenticationError('Invalid email/phone or password.');
    }

    const accessToken = this.generateAccessToken(user);
    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await RefreshTokenModel.create({
      userId: user.id,
      tokenHash,
      expiresAt
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      accessToken,
      refreshToken: rawRefreshToken
    };
  }

  static async refresh(rawRefreshToken) {
    if (!rawRefreshToken) {
      throw new AuthenticationError('Refresh token required.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const tokenRow = await RefreshTokenModel.findByTokenHash(tokenHash);

    if (!tokenRow) {
      throw new AuthenticationError('Invalid refresh token.');
    }

    if (tokenRow.revoked_at) {
      // Security warning: possible token reuse!
      // Revoke all tokens for this user as a safeguard.
      await RefreshTokenModel.revokeAllForUser(tokenRow.user_id);
      throw new AuthenticationError('Refresh token has been revoked previously. All sessions terminated.');
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      throw new AuthenticationError('Refresh token expired.');
    }

    const user = await UserModel.findById(tokenRow.user_id);
    if (!user || user.status === 'DEACTIVATED') {
      throw new AuthenticationError('User not found or deactivated.');
    }

    // Rotate tokens
    const nextAccessToken = this.generateAccessToken(user);
    const nextRawRefreshToken = this.generateRefreshToken();
    const nextTokenHash = this.hashToken(nextRawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Save new token
    const nextTokenRow = await RefreshTokenModel.create({
      userId: user.id,
      tokenHash: nextTokenHash,
      expiresAt
    });

    // Revoke old token and chain it
    await RefreshTokenModel.update(tokenRow.id, {
      revoked_at: new Date(),
      replaced_by_token_id: nextTokenRow.id
    });

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRawRefreshToken
    };
  }

  static async logout(rawRefreshToken) {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashToken(rawRefreshToken);
    const tokenRow = await RefreshTokenModel.findByTokenHash(tokenHash);
    if (tokenRow) {
      await RefreshTokenModel.revoke(tokenRow.id);
    }
  }

  static async forgotPassword({ email, phone }) {
    let user = null;
    if (email) {
      user = await UserModel.findByEmail(email);
    } else if (phone) {
      user = await UserModel.findByPhone(phone);
    }

    if (!user) {
      throw new NotFoundError('User with this email/phone does not exist.');
    }

    // Generate reset token as a short lived JWT
    const resetToken = jwt.sign(
      { userId: user.id, action: 'password-reset' },
      process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026',
      { expiresIn: '15m' }
    );

    // In a real system, you would send email/SMS. Here we return it (or mock the dispatch)
    const frontendUrl = process.env.FRONTEND_URL || 'https://thecreativeart.shop';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    console.log(`Password reset requested. Reset link: ${resetLink}`);
    return { resetToken };
  }

  static async resetPassword({ token, newPassword }) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026'
      );

      if (decoded.action !== 'password-reset') {
        throw new AuthenticationError('Invalid reset token action.');
      }

      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        throw new NotFoundError('User not found.');
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await UserModel.update(user.id, { password_hash: passwordHash });

      // Revoke all refresh tokens to terminate other active sessions
      await RefreshTokenModel.revokeAllForUser(user.id);

      return { success: true };
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthenticationError('Reset token has expired.');
      }
      throw new AuthenticationError('Invalid or malformed reset token.');
    }
  }
}

module.exports = AuthService;
