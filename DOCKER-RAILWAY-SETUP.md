# Docker Setup for Railway Deployment

## Overview
The backend uses Docker to convert GLB files to USDZ format for iOS AR Quick Look.

## Docker Image
- **Image**: `plattar/python-xrutils:latest`
- **Size**: 190 MB
- **Tool**: Google's `usd_from_gltf` (C++ converter)
- **Speed**: 1-3 seconds for typical cooler models

## Railway Configuration

### 1. Docker-in-Docker Support
Railway supports Docker-in-Docker by default. No special configuration needed.

### 2. Environment Variables (Optional)
```bash
# If Railway restricts Docker access, set:
DOCKER_HOST=unix:///var/run/docker.sock
```

### 3. Volume Permissions
The app creates temporary files in the `ar-models` directory. Railway handles this automatically.

## Testing Docker Locally

### Prerequisites
- Docker Desktop installed and running
- Python 3.9+

### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Run Flask App
```bash
python app.py
```

### Test Conversion Endpoint
```bash
# Upload a test GLB file
curl -X POST http://localhost:5000/api/ar/convert-usdz \
  -F "model=@test.glb" \
  -v
```

Expected response:
```json
{
  "url": "http://localhost:5000/ar-models/ar_abc12345.usdz",
  "format": "usdz",
  "size": 1234567
}
```

## Troubleshooting

### Issue: "Docker daemon not reachable"
**Solution**: Ensure Docker Desktop is running locally, or that Railway has Docker access.

### Issue: "Permission denied on /var/run/docker.sock"
**Solution**: On Railway, this should work automatically. Locally, add your user to the docker group:
```bash
sudo usermod -aG docker $USER
```

### Issue: "Image pull failed"
**Solution**: Check internet connectivity. The image is pulled from Docker Hub on first use.

### Issue: Conversion takes > 10 seconds
**Solution**:
- Check file size (keep under 100k triangles)
- Check Railway's CPU allocation
- Consider caching popular configurations

## Monitoring

### Railway Logs
Watch for these log messages:
```
INFO - Converting GLB to USDZ using Docker: temp_abc123.glb (234567 bytes)
INFO - Pulling plattar/python-xrutils Docker image...
INFO - Docker image ready
INFO - Running Docker conversion: usd_from_gltf /input/temp_abc123.glb /output/ar_xyz789.usdz
INFO - USDZ conversion successful: https://...railway.app/ar-models/ar_xyz789.usdz (456789 bytes)
```

### Success Indicators
- ✅ Log shows "USDZ conversion successful"
- ✅ Response format is "usdz" not "glb"
- ✅ File size is 2-5x larger than input GLB
- ✅ iOS AR Quick Look launches on device

### Failure Indicators
- ❌ Log shows "Docker conversion failed, falling back to GLB"
- ❌ Response format is "glb" with warning message
- ❌ Docker errors in logs

## Fallback Behavior
If Docker conversion fails, the app automatically falls back to serving GLB files with a warning. This ensures the app continues working even if Docker is unavailable.

## Performance

### Expected Metrics
- **Conversion time**: 1-3 seconds
- **Memory usage**: ~300 MB during conversion
- **Disk usage**: ~400 MB (Docker image + temp files)
- **USDZ file size**: 2-5x larger than input GLB

### Optimization Tips
1. **Cache conversions**: Store generated USDZ files by configuration hash
2. **Pre-generate popular sizes**: 8-door, 10-door, 12-door, 20-door
3. **Cleanup old files**: Implement periodic cleanup of old AR models
4. **Compress textures**: Reduce input GLB size with texture compression

## Alternative if Docker Doesn't Work

If Railway doesn't support Docker-in-Docker, you can:
1. Use QR code fallback (already implemented)
2. Migrate to a platform that supports Docker (Render, Fly.io)
3. Use a separate microservice for conversion
4. Build usd_from_gltf as a standalone binary and bundle it

## Resources
- [plattar/python-xrutils Docker Hub](https://hub.docker.com/r/plattar/python-xrutils)
- [Google's usd_from_gltf GitHub](https://github.com/google/usd_from_gltf)
- [Railway Docker Documentation](https://docs.railway.app/deploy/dockerfiles)
