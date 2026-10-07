import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelpers } from './test-helpers';
import * as path from 'path';
import * as fs from 'fs';

describe('File Upload Endpoints (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    app = await TestHelpers.setupTestApp();
    authToken = await TestHelpers.registerAndLogin(app);
  });

  afterAll(async () => {
    await TestHelpers.closeApp();
  });

  describe('/rca-evidence/upload (POST)', () => {
    it('should upload a file', async () => {
      // Create a test file
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'This is a test file for evidence upload');

      try {
        const response = await request(app.getHttpServer())
          .post('/rca-evidence/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', testFilePath)
          .expect(201);

        expect(response.body).toHaveProperty('filename');
        expect(response.body).toHaveProperty('path');
        expect(response.body).toHaveProperty('size');
        expect(response.body).toHaveProperty('originalName');
      } finally {
        // Cleanup test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should reject upload without authentication', async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      try {
        await request(app.getHttpServer())
          .post('/rca-evidence/upload')
          .attach('file', testFilePath)
          .expect(401);
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });

  describe('/uploads/evidence (POST)', () => {
    it('should upload file to alternative endpoint', async () => {
      const testFilePath = path.join(__dirname, 'test-image.jpg');
      // Create a minimal test file
      fs.writeFileSync(testFilePath, Buffer.from('fake-image-data'));

      try {
        const response = await request(app.getHttpServer())
          .post('/uploads/evidence')
          .attach('file', testFilePath)
          .expect(201);

        expect(response.body).toHaveProperty('filename');
        expect(response.body).toHaveProperty('path');
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });
});

