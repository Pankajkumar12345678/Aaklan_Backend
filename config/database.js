import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb+srv://pankaj22jics073_db_user:6jbaZksybX8lwdQk@aaklan.1u7xlum.mongodb.net/eduamplify?retryWrites=true&w=majority&appName=Aaklan", 
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
  }
};

export default connectDB;