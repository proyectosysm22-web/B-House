import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://hqltxxwgfwiaickyfmnm.supabase.co/"
const supabaseAnonKey = "sb_publishable_8F22FLJk-JDhKWsxb8BvWA_F0rKyQVu"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)