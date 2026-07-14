const AuthService = require('../services/auth.service');
const { ValidationError } = require('../utils/errors');
const {
  validateRegister,
  validateLogin,
  validateRefresh,
  validateForgotPassword,
  validateResetPassword
} = require('../validators/auth.validator');

class AuthController {
  static async register(req, res, next) {
    try {
      const { error, value } = validateRegister(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const user = await AuthService.register(value);
      res.status(201).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { error, value } = validateLogin(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const result = await AuthService.login(value);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req, res, next) {
    try {
      const { error, value } = validateRefresh(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const result = await AuthService.refresh(value.refreshToken);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(refreshToken);
      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully.' }
      });
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const { error, value } = validateForgotPassword(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const result = await AuthService.forgotPassword(value);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const { error, value } = validateResetPassword(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const result = await AuthService.resetPassword(value);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
