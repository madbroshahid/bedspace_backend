// This script will create initial collections and insert sample documents for the backend
// It will be run automatically by MongoDB on container startup

db = db.getSiblingDB('bedspace_demo');

// Create a sample user (landlord)
db.createCollection("users");

// Create a sample listing (replace landlord ObjectId after first run if needed)
db.createCollection("listings");
