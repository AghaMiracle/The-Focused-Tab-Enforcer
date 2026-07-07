// MongoDB initialization script
// Creates a dedicated database user for the application
db = db.getSiblingDB('focused_tab_enforcer');

db.createUser({
  user: 'fte_app',
  pwd: 'fte_app_password_change_me',
  roles: [
    { role: 'readWrite', db: 'focused_tab_enforcer' },
  ],
});

print('MongoDB initialized: focused_tab_enforcer database and fte_app user created.');
