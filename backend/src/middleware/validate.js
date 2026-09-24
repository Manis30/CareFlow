import { AppError } from "./errorHandler.js";

export const validateRequest = (schema, source = "body") => {
    return (req, res, next) => {
        try {
            const dataToValidate = req[source];
            const parsed = schema.safeParse(dataToValidate);
            if (!parsed.success) {
                const issues = parsed.error.issues.map(
                    (issue) => `${issue.path.join(".")}: ${issue.message}`
                );
                throw new AppError(400, `Validation Error: ${issues.join("; ")}`);
            }
            req[source] = parsed.data;
            next();
        } catch (error) {
            next(error);
        }
    };
};
