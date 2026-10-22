import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

function getEnvironmentVariables() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    return { supabaseUrl, supabaseAnonKey };
}

export async function createSupabaseServerClient() {
    const { supabaseUrl, supabaseAnonKey } = getEnvironmentVariables();
    const cookieStore = await cookies();
    
    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch (error) {
                    console.log(error);
                }
            },
        },
    });
}

export const createClient = createSupabaseServerClient;

/**
 * Cache pemanggilan getUser() per-request lifecycle React.
 * Menghindari duplicate roundtrip network ke /auth/v1/user di Server Components / Server Actions.
 */
export const getCachedUser = cache(async (): Promise<User | null> => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
});