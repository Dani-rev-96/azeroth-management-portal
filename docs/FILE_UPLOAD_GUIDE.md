# Large File Upload Guide

## Overview

The application supports file uploads up to 50GB through the admin panel using **streaming uploads** - files are streamed directly to disk and never loaded into memory, making it safe for very large files like the 40GB WoW client.

## Upload Methods

### Method 1: Admin Panel Upload (Recommended, supports up to 50GB)

The admin panel uses streaming uploads with real-time progress tracking:

1. Go to Admin → File Management
2. Click "Choose File"
3. Select your file (up to 50GB)
4. Click "Upload File"
5. Watch the progress bar for upload status

**Benefits:**

- Real-time progress bar showing upload percentage
- Streaming architecture (file never loaded into memory)
- Automatic file list refresh after upload
- No server memory issues with large files

### Method 2: Direct Filesystem Upload (Alternative)

For offline scenarios or when you already have SSH access: 2. Click "Choose File" 3. Select your file 4. Click "Upload File"

## Configuration

### Increase Upload Limits

The application is configured to handle 50GB uploads, but you may need to adjust your reverse proxy settings:

#### Nginx

```nginx
client_max_body_size 50G;
proxy_read_timeout 3600;
proxy_connect_timeout 3600;
proxy_send_timeout 3600;
```

#### Apache

```apache
LimitRequestBody 53687091200
```

### Environment Variables

- `PUBLIC_PATH`: Directory path for downloads (default: `/data/public`)

## Troubleshooting

### Upload Fails

1. Check server disk space: `df -h`
2. Verify directory permissions: `ls -la /data/public`
3. Check Nitro body size limit in `nuxt.config.ts`
4. Review reverse proxy timeout settings

### File Not Appearing

1. Verify file is in correct directory: `ls -la /data/public`
2. Check file permissions: `chmod 644 /data/public/filename`
3. Refresh the downloads page

### Memory Issues

~~For files larger than available RAM, ensure streaming is working correctly. The application should not load the entire file into memory.~~

**No memory issues!** The application uses busboy streaming - files are written directly to disk as chunks arrive. A 50GB file only uses a few KB of memory during upload.

## Architecture

### File Upload Flow (Streaming)

1. **Client** → Sends file via multipart/form-data with progress tracking (XMLHttpRequest)
2. **Nuxt Server** → Receives raw HTTP request stream
3. **Busboy Parser** → Parses multipart data as stream (no memory buffering)
4. **File Stream** → Writes directly to `$PUBLIC_PATH/filename` in chunks
5. **Storage** → File available at configured public path
6. **Response** → Returns success with filename and size

**Key Benefits:**

- **Constant memory usage**: ~10MB regardless of file size
- **Real-time progress**: Client receives upload progress events
- **Scalable**: Can handle multiple simultaneous uploads
- **Safe**: 50GB file limit enforced at stream level

### Download Flow

1. **Client** → Requests `/api/downloads/filename`
2. **API Endpoint** → Creates read stream
3. **Response** → Streams file to client with proper headers
4. **Client** → Browser downloads file

### Security

- Filename sanitization (basename only, no directory traversal)
- GM-only upload/delete (requires GM level > 0)
- Public read access for all authenticated users
- Path validation to prevent escaping public directory
