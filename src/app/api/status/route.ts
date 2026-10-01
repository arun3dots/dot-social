import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

function readJsonFile(filePath: string, fallback: any = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    // ignore
  }
  return fallback;
}

export async function GET() {
  const rootDir = process.cwd();
  const envReport = readJsonFile(path.join(rootDir, '.tmp', 'env_verification_report.json'));
  const socialReport = readJsonFile(path.join(rootDir, '.tmp', 'social_link_report.json'));
  const llmReport = readJsonFile(path.join(rootDir, '.tmp', 'llm_handshake_report.json'));

  return NextResponse.json({
    env: envReport,
    social: socialReport,
    llm: llmReport,
    serverTime: new Date().toISOString(),
  });
}
