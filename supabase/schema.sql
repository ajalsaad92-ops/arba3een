-- ========================================
-- Database Schema for Governorate Command Hub
-- ========================================

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  national_id TEXT UNIQUE NOT NULL,
  phone TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_records_national_id ON records(national_id);
CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_records_updated_at
  BEFORE UPDATE ON records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO users (username, password, role, full_name)
VALUES ('admin', 'admin123', 'admin', 'المدير العام')
ON CONFLICT (username) DO NOTHING;

INSERT INTO categories (name, description) VALUES
  ('الخدمات الإلكترونية', 'جميع الخدمات الإلكترونية المقدمة'),
  ('الشكاوى', 'شكاوى المواطنين'),
  ('الطلبات', 'طلبات المواطنين'),
  ('الاستفسارات', 'استفسارات عامة')
ON CONFLICT DO NOTHING;
