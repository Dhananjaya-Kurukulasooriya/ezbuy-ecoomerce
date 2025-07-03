#!/bin/bash

# Configuration
DOMAIN="encodap.com"
EMAIL="dhananjaya@encodap.com"  

echo "🔒 Setting up Let's Encrypt SSL for $DOMAIN"

# Create nginx config for initial challenge
cat > nginx-temp.conf << EOF
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name $DOMAIN www.$DOMAIN;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 200 'SSL setup in progress...';
            add_header Content-Type text/plain;
        }
    }
}
EOF

echo "📋 Starting temporary nginx for domain validation..."

# Start nginx with temp config
docker run -d --name nginx-temp \
    -p 80:80 \
    -v $(pwd)/nginx-temp.conf:/etc/nginx/nginx.conf \
    -v $(pwd)/ssl/certbot/www:/var/www/certbot \
    nginx:alpine

echo "🏆 Requesting SSL certificate..."

# Get SSL certificate
docker run --rm \
    -v $(pwd)/ssl/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/ssl/certbot/www:/var/www/certbot \
    -v $(pwd)/ssl/certbot/logs:/var/log/letsencrypt \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN \
    -d www.$DOMAIN

# Stop temporary nginx
docker stop nginx-temp
docker rm nginx-temp

# Clean up temp config
rm nginx-temp.conf

if [ -f "./ssl/certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ SSL certificate generated successfully!"
    echo "📁 Certificate files are in: ./ssl/certbot/conf/live/$DOMAIN/"
    echo "🚀 Now starting the application with SSL..."
    
    # Start the application
    docker-compose up -d
    
    echo "🎉 EzBuy is now running with SSL!"
    echo "🌐 Access your site at: https://$DOMAIN"
else
    echo "❌ SSL certificate generation failed!"
    echo "📋 Check the logs and make sure:"
    echo "   - Domain $DOMAIN points to this server"
    echo "   - Ports 80 and 443 are open"
    echo "   - Email address is valid"
fi