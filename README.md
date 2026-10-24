# Smart Attend AI — Sri Dashmesh School

A responsive Class 12 school-project prototype with browser-based facial recognition attendance. The project starts with an **empty student database**: all built-in sample student names and sample attendance records have been removed.

## Run in VS Code
1. Extract `Smart_Attend_AI.zip`.
2. Open the `Smart_Attend_AI` folder in VS Code.
3. Start the page using the VS Code **Live Server** extension (recommended). Camera access generally requires `localhost` or HTTPS; opening the HTML directly as a `file://` URL may block the camera.
4. Create an account using your name/email and a password of at least 6 characters. The school password is `DASMESH09`.
5. Sign in with the account you created.

## Start with your own students
1. Open **Students → Add Student** and enter your real project/test student details, including admission number, roll number, class, section and a clear face photo.
2. Add each student individually. Daily, weekly, monthly reports and alerts will be based on the students you add; they will be empty until students and attendance records exist.
3. Open **Attendance → Mark Attendance** and allow camera access. The browser loads the face-api.js recognition library and pretrained models from the internet.
4. Recognized enrolled students are marked Present. At the end, click **Finish & mark remaining absent** to mark other students in the selected class/section absent. Review results and correct mistakes manually if needed.

## Features
- Sign-up and sign-in demo flow.
- Responsive dashboard and navigation.
- Empty student database at first launch; add/remove student records and register/replace face photos.
- Browser-based face detection and face-descriptor matching for attendance.
- Manual attendance status corrections.
- Daily, weekly and monthly reports.
- CSV export (opens in Excel) and browser print.
- Alerts for students below 75% attendance, grouped by class and section.

## Important limitations and privacy
- This is a **school-project prototype**, not a production attendance/security system. Face matching can make mistakes because of lighting, camera quality, pose and similar-looking faces; always review the attendance and allow manual correction.
- Face recognition models are loaded from online CDNs, so internet access is required the first time. Camera access requires browser permission and usually `localhost`/HTTPS.
- Student face photos, demo accounts and attendance records are stored in this browser's `localStorage`; they are not securely shared across devices or backed up to a school server. Use fictional/test photos for demonstrations unless you have permission to use real students' photos.
- The project uses CSV export instead of a native `.xlsx` file.
