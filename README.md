# VaMiDzo - Ride Hailing Service for Ghana

## 1. Description

VaMiDzo is a ride-hailing service project designed to operate in Ghana, similar to Lyft or Uber. This project aims to provide a platform connecting riders with drivers for various transportation needs, including standard car rides, Okada (motorcycle taxis), Pragya/Mahama Camboo (tricycles), luxury car rentals, delivery services, and group bus bookings.

This repository contains the codebase for the backend services, the Rider mobile application, and the Driver mobile application.

## 2. Core MVP Features (Planned)

The Minimum Viable Product (MVP) will focus on the following core functionalities:

*   **User Authentication:** Secure registration and login for riders and drivers.
*   **Ride Booking (Standard Cars):** Riders can request point-to-point rides with standard cars.
*   **Driver Availability & Acceptance:** Drivers can toggle their availability and accept/reject ride requests.
*   **Basic GPS Tracking & Fare Estimation:** Display of vehicle location (simulated/basic initially) and simple fare calculation.
*   **Payment Integration (MTN Mobile Money):** Initial focus on MTN MoMo for payments.
*   **Real-time Ride Status Updates:** Notifications for key ride events.
*   **In-App Chat:** Basic communication between rider and driver.
*   **Rating System:** Simple star-based rating for riders and drivers.
*   **Admin Panel (Basic):** User management and ride monitoring.

## 3. Technology Stack

*   **Backend:**
    *   Runtime: Node.js
    *   Framework: Express.js
    *   Database: PostgreSQL
    *   Authentication: JWT (JSON Web Tokens) with bcryptjs for password hashing
    *   Validation: Joi
    *   Real-time Communication: Socket.IO (planned)
    *   Testing: Jest, Supertest
*   **Mobile Applications (Rider & Driver):**
    *   Framework: React Native
    *   Navigation: React Navigation
    *   API Communication: Axios
    *   Local Storage: AsyncStorage
    *   Mapping: `react-native-maps` (planned)
    *   State Management: React Context API (initial setup)
*   **General:**
    *   Version Control: Git

## 4. Project Structure

The monorepo is organized as follows:

*   `backend/`: Contains the Node.js/Express.js backend application.
    *   `src/`: Source code for the backend (controllers, services, routes, models, etc.).
    *   `tests/`: Backend test files.
    *   `uploads/`: Directory for local file uploads (e.g., profile pictures during development).
*   `VaMiDzoRider/`: Contains the React Native application for riders.
    *   `src/`: Source code (screens, components, navigation, services, contexts, etc.).
*   `VaMiDzoDriver/`: Contains the React Native application for drivers.
    *   `src/`: Source code (screens, components, navigation, services, contexts, etc.).
*   `database/`: Contains database-related files.
    *   `schema.sql`: The DDL for creating the initial database schema.

## 5. Prerequisites

Before you begin, ensure you have the following installed:

*   Node.js (v18 or later recommended)
*   npm or yarn
*   PostgreSQL Server (running and accessible)
*   React Native Development Environment:
    *   Xcode (for iOS development on macOS)
    *   Android Studio (for Android development)
    *   React Native CLI tools (`@react-native-community/cli`)
*   Git

## 6. Setup & Installation (Initial)

### 6.1. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```
3.  **Set up environment variables:**
    *   Copy the `.env.example` file to a new file named `.env`:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file with your local PostgreSQL database credentials (DB_USER, DB_PASSWORD, DB_NAME, etc.) and a `JWT_SECRET`.
4.  **Database Setup:**
    *   Ensure your PostgreSQL server is running.
    *   Create the database specified in your `.env` file (e.g., `ghana_cabs_db`).
    *   Connect to your PostgreSQL server (e.g., using `psql` or a GUI tool like pgAdmin).
    *   Execute the `database/schema.sql` script against your newly created database to create the tables.
        ```bash
        # Example using psql:
        # psql -U your_db_user -d your_db_name -a -f ../database/schema.sql
        ```
5.  **Start the backend server:**
    ```bash
    npm run dev # For development with nodemon (auto-restarts)
    # or
    # npm start # For production mode
    ```
    The server should start, typically on `http://localhost:3000` (or the port specified in your `.env`).

### 6.2. Mobile Applications (VaMiDzoRider & VaMiDzoDriver)

The mobile app structures (`VaMiDzoRider/` and `VaMiDzoDriver/`) were manually created as blueprints. To run them, you'd typically initialize a full React Native project and then integrate these files.

**General Steps (perform for both `VaMiDzoRider` and `VaMiDzoDriver`):**

1.  **Initialize a new React Native project (if starting fresh in a local dev environment):**
    *   It's recommended to use the React Native CLI for proper native project setup:
        ```bash
        npx @react-native-community/cli init VaMiDzoRider # (or VaMiDzoDriver)
        ```
    *   Then, carefully merge the existing files from this repository's `VaMiDzoRider` (or `VaMiDzoDriver`) directory into the newly created project, replacing placeholder files like `App.js`, `package.json` dependencies, and adding the `src/` directory.
2.  **Navigate to the app directory:**
    ```bash
    cd VaMiDzoRider  # or cd VaMiDzoDriver
    ```
3.  **Install dependencies:**
    *   Review the `package.json` in the respective app directory.
    *   Run:
        ```bash
        npm install
        # or
        # yarn install
        ```
4.  **iOS Specific (if developing for iOS):**
    ```bash
    cd ios
    pod install
    cd ..
    ```
5.  **Run the application:**
    *   **For Android:**
        ```bash
        npm run android
        # or (if using yarn)
        # yarn android
        ```
    *   **For iOS:**
        ```bash
        npm run ios
        # or (if using yarn)
        # yarn ios
        ```
    Ensure an emulator/simulator is running or a device is connected. The backend server should also be running for API calls to work (the apps are configured to point to `http://10.0.2.2:3000` for Android emulators and `http://localhost:3000` for iOS simulators by default in `src/services/api.js`).

## 7. Running Backend Tests

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Run the tests:**
    ```bash
    npm test
    ```
    This will execute Jest tests. Initial tests cover some authentication endpoints.

## 8. API (Backend)

The backend API is served under `/api/v1/`. Key initial routes:

*   `POST /api/v1/auth/register/rider`
*   `POST /api/v1/auth/register/driver`
*   `POST /api/v1/auth/login`
*   `GET /api/v1/auth/me` (Protected)
*   `PUT /api/v1/users/me` (Protected)
*   `POST /api/v1/users/me/profile-picture` (Protected)
*   `PUT /api/v1/users/me/vehicle` (Protected, Driver only)
*   `GET /api/v1/health`

Refer to Joi schemas in `backend/src/validations/` for request body structures.

---

This README provides a starting point. It will be updated as the project progresses.
