import { AppDataSource } from '../src/db/data-source';

export default async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.dropDatabase();
    await AppDataSource.destroy();
  }
};