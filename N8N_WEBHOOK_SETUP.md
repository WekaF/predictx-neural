# n8n Deployment Webhook Setup

Quick guide untuk setup n8n webhook notifications untuk deployment events.

## 🔧 Setup GitHub Secret

Add `N8N_WEBHOOK_URL` secret ke GitHub repository:

1. **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Name: `N8N_WEBHOOK_URL`
4. Value: Your n8n webhook URL (e.g., `https://weka.app.n8n.cloud/webhook/deployment-notifications`)
5. Click **"Add secret"**

## 📥 Webhook Payload Structure

Your n8n workflow will receive these payloads:

### Deployment Started
```json
{
  "event": "deployment",
  "status": "started",
  "commit": {
    "hash": "abc123...",
    "message": "Update feature X",
    "author": "Your Name",
    "url": "https://github.com/..."
  },
  "deployment": {
    "environment": "production",
    "timestamp": "2026-02-08T10:00:00Z",
    "repository": "WekaF/predictx-neural",
    "branch": "main"
  },
  "workflow": {
    "run_id": "123456",
    "run_number": "42",
    "run_url": "https://github.com/.../actions/runs/123456"
  }
}
```

### Deployment Success
```json
{
  "event": "deployment",
  "status": "success",
  "commit": { ... },
  "deployment": {
    "url": "https://predictx-neural.vercel.app",
    "environment": "production",
    ...
  },
  "workflow": { ... }
}
```

### Deployment Failed
```json
{
  "event": "deployment",
  "status": "failed",
  "commit": { ... },
  "deployment": { ... },
  "workflow": { ... },
  "error": {
    "message": "Deployment failed. Check workflow logs for details."
  }
}
```

## 🔄 Example n8n Workflow

Create this workflow in n8n:

```
1. Webhook Trigger (POST)
   ↓
2. Switch Node (based on $.status)
   ├─ started → Send "🚀 Deployment started" notification
   ├─ success → Send "✅ Deployment successful" notification
   └─ failed → Send "❌ Deployment failed" alert
```

### Webhook Node Configuration
- **Method:** POST
- **Path:** `/deployment-notifications` (or your choice)
- **Response Mode:** Immediately
- **Response Code:** 200

### Example Telegram Message (Success)
```
✅ Deployment Successful!

📦 Repository: WekaF/predictx-neural
🌿 Branch: main
👤 Author: {{ $json.commit.author }}

💬 Commit: {{ $json.commit.message }}

🔗 Live URL: {{ $json.deployment.url }}
📊 Workflow: {{ $json.workflow.run_url }}

⏰ {{ $json.deployment.timestamp }}
```

## ✅ Testing

After adding the secret, test by pushing a commit:

```bash
git add .
git commit -m "Test deployment webhook"
git push
```

You should receive 3 webhooks:
1. **Started** - When deployment begins
2. **Success** - When deployment completes (or)
3. **Failed** - If deployment fails

## 🔍 Troubleshooting

**Webhook not received?**
- Check `N8N_WEBHOOK_URL` secret is set correctly
- Verify n8n workflow is active
- Check GitHub Actions logs for curl errors

**Payload is empty?**
- Ensure n8n webhook accepts POST requests
- Check n8n webhook path matches your URL

## 📚 Webhook URL Examples

- **n8n Cloud:** `https://your-instance.app.n8n.cloud/webhook/deployment-notifications`
- **Self-hosted:** `https://n8n.yourdomain.com/webhook/deployment-notifications`
- **Test URL:** `https://weka.app.n8n.cloud/webhook-test/...` (temporary)

---

**Note:** Webhook notifications use `continue-on-error: true`, so deployment won't fail if webhook fails.
