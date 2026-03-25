import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import type { UploadShoeImageUseCase } from '@usecase/UploadShoeImageUseCase.port';
import { ValidationError } from '@domain/errors/ValidationError';
import { asyncRoute } from './middleware/routeMiddleware';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

export type ShoeImageRouteGuards = {
  admin?: RequestHandler[];
};

export class ShoeImageController {
  private readonly uploadShoeImage: UploadShoeImageUseCase;

  constructor(uploadShoeImage: UploadShoeImageUseCase) {
    this.uploadShoeImage = uploadShoeImage;
  }

  routes(guards?: ShoeImageRouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.post(
      '/upload',
      ...admin,
      uploadMiddleware.single('image'),
      asyncRoute(this.upload.bind(this))
    );
    return router;
  }

  private async upload(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({
        error: 'NO_FILE',
        message: 'Image file is required (form field name: image).',
      });
      return;
    }
    const result = await this.uploadShoeImage.execute({
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
    res.status(201).json(result);
  }
}
