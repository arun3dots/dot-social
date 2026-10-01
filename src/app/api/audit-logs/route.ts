import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const rootDir = process.cwd();
    const logPath = path.join(rootDir, '.tmp', 'published_posts.json');

    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ logs: [] });
    }

    const data = fs.readFileSync(logPath, 'utf-8');
    const logs = JSON.parse(data);
    return NextResponse.json({ logs: Array.isArray(logs) ? logs.reverse() : [] });
  } catch (error: any) {
    return NextResponse.json({ logs: [], error: error.message });
  }
}
