import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import {
  Button,
  IconButton,
  TextField,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Stack,
} from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import RestoreIcon from "@mui/icons-material/Restore";
import { AuthContext } from "../contexts/AuthContext";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(AuthContext);

  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) return;
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  const handleNewMeeting = () => {
    const newCode = Math.random().toString(36).substring(2, 8);
    navigate(`/${newCode}`);
  };

  return (
    <>
      {/* NAVBAR */}
      <AppBar
        position="static"
        elevation={0}
        sx={{ background: "white", color: "black" }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h5" fontWeight="bold">
            NexMeet
          </Typography>

          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate("/history")}>
              <RestoreIcon />
            </IconButton>

            <Button
              variant="outlined"
              onClick={() => {
                localStorage.removeItem("token");
                navigate("/auth");
              }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* MAIN SECTION */}
      <Container maxWidth="lg">
        <Box
          sx={{
            minHeight: "85vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          {/* LEFT CONTENT */}
          <Box flex={1}>
            <Typography variant="h3" fontWeight="bold" gutterBottom>
              Premium Video Meetings.
              <br />
              Now Free for Everyone.
            </Typography>

            <Typography variant="h6" color="text.secondary" mb={4}>
              Secure, reliable video meetings for your team and friends.
            </Typography>

            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                variant="contained"
                startIcon={<VideoCallIcon />}
                sx={{
                  background: "#1a73e8",
                  paddingX: 3,
                  borderRadius: "30px",
                  "&:hover": { background: "#1558b0" },
                }}
                onClick={handleNewMeeting}
              >
                New Meeting
              </Button>

              <TextField
                variant="outlined"
                placeholder="Enter meeting code"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                sx={{
                  width: "250px",
                  background: "white",
                  borderRadius: "30px",
                }}
              />

              <Button
                variant="text"
                sx={{ fontWeight: "bold" }}
                onClick={handleJoinVideoCall}
              >
                Join
              </Button>
            </Stack>
          </Box>

          {/* RIGHT IMAGE */}
          <Box flex={1} textAlign="center" mt={{ xs: 5, md: 0 }}>
            <img
              src="/logo3.png"
              alt="Video Call"
              style={{
                width: "100%",
                maxWidth: "450px",
              }}
            />
          </Box>
        </Box>
      </Container>
    </>
  );
}

export default withAuth(HomeComponent);
