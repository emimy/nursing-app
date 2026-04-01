require('dotenv').config({ path: '.env.local', override: true });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

console.log("🔄 Loading environment variables...");
console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Found" : "❌ Missing");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Found" : "❌ Missing");

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAuthUsers() {
  try {
    const { data: nurses, error } = await supabaseAdmin
      .from('nurses')
      .select('nurse_id, staff_name, department, email, hashed_password');

    if (error) {
      console.error('❌ Error fetching nurses:', error);
      return;
    }
    if (!nurses || nurses.length === 0) {
      console.log('No nurses found in the database.');
      return;
    }

    const passwordsCsv = ['nurse_id,staff_name,email,password'];

    for (const nurse of nurses) {
      try {
        const email = nurse.email;
        const password = nurse.hashed_password;

        // Correct way to get list of users
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ limit: 1000 });
        const authUsers = authData.users || [];
        const exists = authUsers.some(u => u.email === email);

        if (!exists) {
          const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            user_metadata: { nurse_id: nurse.nurse_id }
          });

          if (error) {
            console.error(`❌ Error creating user for ${nurse.staff_name}:`, error);
          } else {
            console.log(`✅ Created Auth user for ${nurse.staff_name}`);
            passwordsCsv.push(`${nurse.nurse_id},${nurse.staff_name},${email},${password}`);
          }
        } else {
          console.log(`ℹ️ Auth user already exists for ${nurse.staff_name}`);
        }
      } catch (err) {
        console.error(`❌ Failed for ${nurse.staff_name}:`, err);
      }
    }

    fs.writeFileSync('nurses_passwords.csv', passwordsCsv.join('\n'));
    console.log('\n✅ Success! Password CSV saved: nurses_passwords.csv');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createAuthUsers();
