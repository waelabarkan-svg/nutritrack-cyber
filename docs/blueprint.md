# **App Name**: NutriTrack

## Core Features:

- Secure User Authentication: Implement Firebase email and password authentication for secure user registration and login, ensuring data privacy and access control.
- Personalized Health Profile & Goals: Users create and manage their profiles, entering biometrics (gender, age, height, current/target weight) and activity levels. This tool automatically recalculates daily calorie and macro goals (carbohydrates, proteins, fats) based on the Mifflin-St Jeor formula and user-defined ratios. All profile data is stored in Firestore.
- Intuitive Food Diary: An easy-to-use interface to log daily food intake, organized by meal categories (breakfast, lunch, dinner, snacks). Users can add custom foods with detailed nutritional information (calories, macros) and save favorite foods or meals for quick re-entry. All food log data is stored in Firestore.
- Dynamic Progress Dashboard: A visually engaging dashboard displays real-time progress using dynamic circular bars for daily calorie and macro intake. It also includes an animated hydration tracker and a calendar-based historical view to monitor nutritional trends and achievements, fetching data from Firestore.
- Offline Sync & Mobile-Optimized Design: Leverage Firebase's offline caching capabilities to allow seamless data access and entry without an internet connection. The app is designed mobile-first, ensuring responsiveness and an intuitive, one-handed user experience with a floating action button for quick additions and simplified navigation.

## Style Guidelines:

- Color scheme: Dark mode, evoking a modern, health-focused aesthetic akin to Apple Health. The background is a deeply desaturated dark greenish-grey (#1C231E), providing a subtle base.
- Primary color: A vibrant, clear green (#33E556) is used for visualizing calorie metrics and primary interactive elements, ensuring good contrast against the dark background.
- Accent color: A clean, inviting blue (#45BBF0) is dedicated to highlighting hydration tracking and secondary interactive elements, complementing the primary green without conflict.
- Headline and body font: 'Inter' (sans-serif), chosen for its modern, clean, and highly readable characteristics, suitable for conveying health data clearly across various screen sizes.
- Utilize minimalist, clear, and high-contrast vector icons consistent with the 'Apple Health' design language to maintain visual clarity and intuitiveness.
- Mobile-first design optimized for one-handed use, featuring card-based UI elements with glassmorphism effects for a sleek, layered look. A prominent floating '+' button for quick data entry and a simplified, accessible mobile navigation system.
- Fluid, subtle animations throughout the application, providing delightful visual feedback upon user interactions such as adding a food item, navigating between screens, or updating progress visuals.