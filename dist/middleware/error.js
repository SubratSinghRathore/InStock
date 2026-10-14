"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = exports.AppError = void 0;
const env_1 = require("../config/env");
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route not found: ${req.method} ${req.originalUrl}`,
        },
    });
};
exports.notFoundHandler = notFoundHandler;
const errorHandler = (err, _req, res, _next) => {
    let statusCode = err.statusCode || 500;
    let code = err.code || 'INTERNAL_ERROR';
    let message = err.message || 'An unexpected error occurred';
    let details = err.details;
    // Handle MongoDB duplicate key error
    if (err.code === 11000) {
        statusCode = 409;
        code = 'DUPLICATE_KEY';
        const fields = Object.keys(err.keyPattern || {});
        message = `A resource with the same ${fields.join(', ')} already exists.`;
    }
    // Handle MongoDB invalid ObjectId cast error
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 400;
        code = 'INVALID_ID';
        message = `Invalid ID format for field '${err.path}'`;
    }
    const response = {
        success: false,
        error: {
            code,
            message,
        },
    };
    if (details) {
        response.error.details = details;
    }
    if (env_1.config.nodeEnv === 'development' && statusCode === 500 && err.stack) {
        response.error.stack = err.stack;
    }
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
