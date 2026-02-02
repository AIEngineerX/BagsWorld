# fal.ai + Flux Setup Guide

## 1. Create Account & Get API Key

1. Go to https://fal.ai
2. Sign up / Log in
3. Go to https://fal.ai/dashboard/keys
4. Create a new API key
5. Copy the key (starts with `fal_...` or similar)

## 2. Add to Environment

### Local Development
Add to `.env.local`:
```bash
FAL_KEY=your_fal_api_key_here
```

### Netlify Production
1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add: `FAL_KEY` = `your_fal_api_key_here`
3. Redeploy

## 3. Pricing (as of 2025)

| Model | Speed | Cost |
|-------|-------|------|
| Flux.1 Dev | ~5-10s | ~$0.025/image |
| Flux.1 Schnell | ~2-3s | ~$0.003/image |
| Flux.1 Pro | ~10-15s | ~$0.05/image |

**Recommendation:** Use `flux/schnell` for Pokécenter (fast + cheap), `flux/dev` for Professor Oak (better quality).

## 4. Models Available

- `fal-ai/flux/dev` - Best quality, slower
- `fal-ai/flux/schnell` - Fast, good quality (recommended for tokens)
- `fal-ai/flux-pro` - Highest quality, most expensive
- `fal-ai/flux-lora` - Fine-tuned versions

## 5. Test Your Key

```bash
curl -X POST "https://fal.run/fal-ai/flux/schnell" \
  -H "Authorization: Key YOUR_FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cute pixel art robot mascot",
    "image_size": {"width": 512, "height": 512},
    "num_images": 1
  }'
```

Should return JSON with `images[0].url`.
