#!/bin/bash

# Add read only permission to the MongoDB access key file
sudo chmod 400 confs/mongod.access.key

# Run MongoDB containers (3 Nodes)
echo "Creating mongo containers..."
docker compose -f docker-compose.yaml up -d --build eg-backend-mongo-rs0 eg-backend-mongo-rs1 eg-backend-mongo-rs2

# Connect Primary MongoDB container bash
# Run script using mongosh inside attached MongoDB container bash, It should return status ok for further steps
echo "Initialize replica set configuration..."

# Sleep & proceed further
sleep 2

docker exec eg-backend-mongo-rs0 bash -c '
mongosh <<EOF
const config = {
  "_id": "fabzen-cluster",
  "version": 1,
  "members": [
    {
      "_id": 0,
      "host": "eg-backend-mongo-rs0:27017",
      "priority": 1000
    },
    {
      "_id": 1,
      "host": "eg-backend-mongo-rs1:27017",
      "priority": 0
    },
    {
      "_id": 2,
      "host": "eg-backend-mongo-rs2:27017",
      "priority": 0
    }
  ]
};
rs.initiate(config);
rs.status();
EOF
'

# Connect Primary MongoDB container bash
# Create user for DB connection
echo "Please wait, while creating database user to connect applications"

# Wait for 20 sec for internal mongo node connections
sleep 20

docker exec -it eg-backend-mongo-rs0 bash -c '
mongosh <<EOF
  const admin = db.getSiblingDB("admin");
  admin.createUser(
    {
      user: "root",
      pwd: "LP1TCrK5CQn7qOU8",
      roles: [ { role: "root", db: "admin" } ]
    }
  )
EOF
'

# Add full permission to the MongoDB Data
sudo chmod -R a+rwx mongo_data


echo "Local mongo cluster up and running..."
echo "Connection URI: mongodb://root:LP1TCrK5CQn7qOU8@eg-backend-mongo-rs0:27017,eg-backend-mongo-rs1:27018,eg-backend-mongo-rs2:27019/?authSource=admin&readPreference=primary&ssl=false&replicaSet=fabzen-cluster"
