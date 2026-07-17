import * as Joi from 'joi';

export const validationSchema = Joi.object({

  NODE_ENV: Joi.string().required(),

  PORT: Joi.number().required(),

  APP_NAME: Joi.string().required(),

  DATABASE_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().min(32).required(),

  JWT_EXPIRES_IN: Joi.string().required(),

  JWT_REFRESH_SECRET: Joi.string().min(32).required(),

  JWT_REFRESH_EXPIRES_IN: Joi.string().required(),

});
