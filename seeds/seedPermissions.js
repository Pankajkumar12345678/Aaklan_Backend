import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';

dotenv.config();

const defaultPermissions = [
  {
    role: 'admin',
    permissions: {
      templates: {
        create: true,
        read: true,
        update: true,
        delete: true,
        access: ['lesson_plan', 'unit_plan', 'quiz', 'project', 'gagne_lesson_plan', 'debate', 'blank']
      },
      content: {
        create: true,
        read: true,
        update: true,
        delete: true,
        publish: true,
        share: true,
        duplicate: true
      },
      ai: {
        generate: true,
        regenerate: true,
        dailyLimit: 1000
      },
      export: {
        docx: true,
        pdf: true,
        pptx: true,
        google_docs: true
      },
      users: {
        view: true,
        create: true,
        update: true,
        delete: true,
        change_role: true
      },
      admin: {
        dashboard: true,
        analytics: true,
        system_settings: true,
        manage_permissions: true
      },
      organization: {
        view: true,
        manage: true,
        invite_users: true
      }
    },
    description: 'Full system access with all permissions'
  },
  {
    role: 'teacher',
    permissions: {
      templates: {
        create: true,
        read: true,
        update: true,
        delete: false,
        access: ['lesson_plan', 'unit_plan', 'quiz', 'project', 'gagne_lesson_plan', 'debate', 'blank']
      },
      content: {
        create: true,
        read: true,
        update: true,
        delete: true,
        publish: true,
        share: true,
        duplicate: true
      },
      ai: {
        generate: true,
        regenerate: true,
        dailyLimit: 50
      },
      export: {
        docx: true,
        pdf: true,
        pptx: true,
        google_docs: false
      },
      users: {
        view: false,
        create: false,
        update: false,
        delete: false,
        change_role: false
      },
      admin: {
        dashboard: false,
        analytics: false,
        system_settings: false,
        manage_permissions: false
      },
      organization: {
        view: true,
        manage: false,
        invite_users: false
      }
    },
    description: 'Standard teacher permissions with content creation and AI access'
  },
  {
    role: 'student',
    permissions: {
      templates: {
        create: false,
        read: true,
        update: false,
        delete: false,
        access: ['lesson_plan', 'quiz'] // Students can only view lessons and quizzes
      },
      content: {
        create: false,
        read: true, // Can view shared content
        update: false,
        delete: false,
        publish: false,
        share: false,
        duplicate: false
      },
      ai: {
        generate: false,
        regenerate: false,
        dailyLimit: 0
      },
      export: {
        docx: false,
        pdf: true, // Can export as PDF for personal use
        pptx: false,
        google_docs: false
      },
      users: {
        view: false,
        create: false,
        update: false,
        delete: false,
        change_role: false
      },
      admin: {
        dashboard: false,
        analytics: false,
        system_settings: false,
        manage_permissions: false
      },
      organization: {
        view: true,
        manage: false,
        invite_users: false
      }
    },
    description: 'Limited access for students - view only with PDF export'
  }
];

async function seedPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for permission seeding');

    // Clear existing permissions
    await Permission.deleteMany({});
    console.log('Cleared existing permissions');

    // Insert default permissions
    await Permission.insertMany(defaultPermissions);
    console.log(`✅ Created ${defaultPermissions.length} permission sets`);

    // Display permission summary
    console.log('\n📋 Permission Summary:');
    defaultPermissions.forEach(perm => {
      console.log(`\n👤 ${perm.role.toUpperCase()}:`);
      console.log(`   Templates: ${perm.permissions.templates.access.join(', ')}`);
      console.log(`   AI Daily Limit: ${perm.permissions.ai.dailyLimit}`);
      console.log(`   Export: ${Object.keys(perm.permissions.export).filter(k => perm.permissions.export[k]).join(', ')}`);
      console.log(`   Admin Access: ${perm.permissions.admin.dashboard ? 'Yes' : 'No'}`);
    });

    console.log('\n🎉 Default permissions seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Permission seeding failed:', error);
    process.exit(1);
  }
}

seedPermissions();