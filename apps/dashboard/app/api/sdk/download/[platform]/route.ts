/**
 * SDK Download API
 * Serves SDK files for manual installation
 */

import { NextResponse } from 'next/server';
// TODO: Re-enable when file serving is implemented
// import { readFile } from 'fs/promises';
// import { join } from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    // TODO: Implement actual file serving
    // let filePath: string;
    // let fileName: string;
    // let contentType: string;

    switch (platform) {
      case 'js':
      case 'kotlin':
      case 'flutter':
        // Valid platforms - will be implemented
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid platform' },
          { status: 400 }
        );
    }

    // For now, return a response indicating the file location
    // In production, you would actually serve the built files
    return NextResponse.json({
      platform,
      message: 'SDK download will be available after build',
      manualInstallation: true,
      gitUrl: `https://github.com/bhed/open-productdrivers/tree/main/packages/sdk-${platform}`,
    });

  } catch (error) {
    console.error('Error downloading SDK:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

