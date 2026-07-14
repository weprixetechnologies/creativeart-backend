const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().max(150).required(),
  // Allow the user to register with email, phone, or both.
  // .or() requires at least one of these to be present.
  // We do NOT use allow(null,'') here — the frontend strips empty strings
  // from the payload before sending, so absent keys are truly absent.
  email: Joi.string().email().max(190).optional(),
  phone: Joi.string().max(20).optional(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('CUSTOMER', 'ADMIN', 'STAFF_PRODUCTION', 'STAFF_PACKAGING').default('CUSTOMER')
}).or('email', 'phone'); // at least one of email or phone must be present

const loginSchema = Joi.object({
  email: Joi.string().email().max(190),
  phone: Joi.string().max(20),
  password: Joi.string().required()
}).or('email', 'phone');

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().max(190),
  phone: Joi.string().max(20)
}).or('email', 'phone');

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

module.exports = {
  validateRegister: (data) => registerSchema.validate(data),
  validateLogin: (data) => loginSchema.validate(data),
  validateRefresh: (data) => refreshSchema.validate(data),
  validateForgotPassword: (data) => forgotPasswordSchema.validate(data),
  validateResetPassword: (data) => resetPasswordSchema.validate(data)
};
