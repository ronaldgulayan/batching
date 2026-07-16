import { useState } from "react";
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Stack,
  Alert,
  ThemeIcon,
  Box,
  Badge,
  Group,
  useMantineTheme,
} from "@mantine/core";
import { AlertCircle, Building2, Lock, Mail, LogIn } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const theme = useMantineTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSupabaseConfigured) {
        // Attempt real Supabase Auth
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          // If it fails, let's also allow a local admin fallback as a convenience for development
          if (email === "admin@solidbatching.com" && password === "admin123") {
            localStorage.setItem("solid_batching_auth", "true");
            onLoginSuccess();
            return;
          }
          throw authError;
        }

        if (data.session) {
          onLoginSuccess();
        }
      } else {
        // Local simulation fallback
        if (email === "admin@solidbatching.com" && password === "admin123") {
          localStorage.setItem("solid_batching_auth", "true");
          onLoginSuccess();
        } else {
          setError("Invalid local credentials. Use: admin@solidbatching.com / admin123");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "radial-gradient(circle at 10% 20%, rgba(13, 20, 35, 1) 0%, rgba(8, 11, 20, 1) 90%)",
        position: "relative",
        overflow: "hidden",
        padding: "16px",
      }}
    >
      {/* Decorative background gradients */}
      <Box
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "50%",
          height: "60%",
          background: "radial-gradient(circle, rgba(26, 115, 232, 0.15) 0%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <Box
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "-10%",
          width: "50%",
          height: "60%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <Paper
        withBorder
        shadow="xl"
        p={{ base: "xl", sm: 50 }}
        radius="lg"
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "rgba(19, 25, 38, 0.75)",
          backdropFilter: "blur(20px)",
          borderColor: "rgba(255, 255, 255, 0.08)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          zIndex: 1,
        }}
      >
        <form onSubmit={handleLogin}>
          <Stack gap="xl">
            {/* Header branding */}
            <Stack gap="xs" align="center" style={{ textAlign: "center" }}>
              <ThemeIcon
                size={64}
                radius="xl"
                variant="gradient"
                gradient={{ from: "blue.7", to: "indigo.8", deg: 135 }}
                style={{
                  boxShadow: "0 0 25px rgba(26, 115, 232, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                <Building2 size={32} />
              </ThemeIcon>
              <div>
                <Title order={1} style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                  Solid Batching
                </Title>
                <Text size="sm" c="dimmed" mt={4}>
                  Enterprise Resource Planning System
                </Text>
              </div>
            </Stack>

            {/* Config badge */}
            <Group justify="center">
              {isSupabaseConfigured ? (
                <Badge variant="light" color="blue" radius="sm">
                  Connected to Supabase Auth
                </Badge>
              ) : (
                <Badge variant="light" color="yellow" radius="sm">
                  Demo Mode (Local Credentials)
                </Badge>
              )}
            </Group>

            {/* Errors */}
            {error && (
              <Alert icon={<AlertCircle size={16} />} color="red" radius="md" title="Login Failed">
                <Text size="xs">{error}</Text>
              </Alert>
            )}

            {/* Form Fields */}
            <Stack gap="md">
              <TextInput
                label="Email Address"
                placeholder="you@solidbatching.com"
                required
                leftSection={<Mail size={16} color={theme.colors.gray[6]} />}
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                styles={{
                  input: {
                    backgroundColor: "rgba(15, 20, 30, 0.6)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    "&:focus": {
                      borderColor: theme.colors.blue[6],
                    },
                  },
                }}
              />

              <PasswordInput
                label="Password"
                placeholder="Your secure password"
                required
                leftSection={<Lock size={16} color={theme.colors.gray[6]} />}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                styles={{
                  input: {
                    backgroundColor: "rgba(15, 20, 30, 0.6)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    "&:focus": {
                      borderColor: theme.colors.blue[6],
                    },
                  },
                }}
              />
            </Stack>

            {/* Login button */}
            <Button
              type="submit"
              size="lg"
              radius="md"
              fullWidth
              loading={loading}
              rightSection={<LogIn size={18} />}
              variant="gradient"
              gradient={{ from: "blue.6", to: "indigo.6", deg: 135 }}
              style={{
                transition: "transform 0.1s ease, box-shadow 0.2s ease",
                boxShadow: "0 8px 16px rgba(26, 115, 232, 0.15)",
                fontWeight: 600,
              }}
              className="loginBtn"
            >
              Sign In
            </Button>

            {!isSupabaseConfigured && (
              <Paper p="xs" radius="sm" style={{ backgroundColor: "rgba(251, 191, 36, 0.06)", border: "1px solid rgba(251, 191, 36, 0.15)" }}>
                <Text size="xs" c="yellow.4" style={{ textAlign: "center" }}>
                  <strong>Demo account:</strong> admin@solidbatching.com / admin123
                </Text>
              </Paper>
            )}
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
