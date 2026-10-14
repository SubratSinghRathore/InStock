"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const inventory_routes_1 = __importDefault(require("./routes/inventory.routes"));
const supplier_routes_1 = __importDefault(require("./routes/supplier.routes"));
const sale_routes_1 = __importDefault(require("./routes/sale.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const business_routes_1 = __importDefault(require("./routes/business.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const error_1 = require("./middleware/error");
const env_1 = require("./config/env");
const createApp = () => {
    const app = (0, express_1.default)();
    // Security headers
    app.use((0, helmet_1.default)());
    // CORS
    app.use((0, cors_1.default)({
        origin: env_1.config.corsOrigin === '*' ? true : env_1.config.corsOrigin,
        credentials: true,
    }));
    // Rate Limiting (100 req per minute)
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 150,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later.',
            },
        },
    });
    // Body parser
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Logging (skip during test runs)
    if (env_1.config.nodeEnv !== 'test') {
        app.use((0, morgan_1.default)('dev'));
    }
    // Health check endpoint
    app.get('/api/v1/health', (_req, res) => {
        res.json({
            success: true,
            data: {
                service: 'in-stock-backend',
                status: 'UP',
                timestamp: new Date().toISOString(),
                environment: env_1.config.nodeEnv,
            },
        });
    });
    // Apply rate limiter to API routes
    app.use('/api/v1', limiter);
    // Mount API modules
    app.use('/api/v1/auth', auth_routes_1.default);
    app.use('/api/v1/products', product_routes_1.default);
    app.use('/api/v1/inventory', inventory_routes_1.default);
    app.use('/api/v1/suppliers', supplier_routes_1.default);
    app.use('/api/v1/sales', sale_routes_1.default);
    app.use('/api/v1/reports', report_routes_1.default);
    app.use('/api/v1/business', business_routes_1.default);
    app.use('/api/v1/upload', upload_routes_1.default);
    // 404 & Centralized Error Handler
    app.use(error_1.notFoundHandler);
    app.use(error_1.errorHandler);
    return app;
};
exports.createApp = createApp;
