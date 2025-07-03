# Create the admin setup script

#!/bin/bash
echo "🔧 EzBuy Admin Setup Script"
echo "================================"

# Restart frontend to load new admin page
echo "🔄 Restarting frontend service..."
docker-compose restart frontend

# Create admin user
echo "👤 Creating admin user..."
read -p "Admin email: " ADMIN_EMAIL
read -s -p "Admin password: " ADMIN_PASSWORD
echo

# Register admin user
echo "📝 Registering admin user..."
curl -X POST https://encodap.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"

echo ""

# Make user admin in database
echo "🔐 Setting admin role in database..."
docker exec -it ezbuy_mongodb mongo -u admin -p password123 --eval "
db = db.getSiblingDB('ezbuy');
db.users.updateOne({email: '$ADMIN_EMAIL'}, {\$set: {role: 'admin'}});
var user = db.users.findOne({email: '$ADMIN_EMAIL'});
print('Admin user:', JSON.stringify({email: user.email, role: user.role}));
"

echo ""
echo "✅ Admin setup complete!"
echo "📧 Admin email: $ADMIN_EMAIL"
echo "🌐 Admin panel: https://encodap.com/admin"
echo ""