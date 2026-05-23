import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Actions では GITHUB_REPOSITORY="owner/repo-name" が自動設定される
  base: process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/',
});
