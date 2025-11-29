-- Thêm Student users vào bảng users
-- RoleID = 3 là Student (từ bảng role)

-- Student 1: Nghia
INSERT INTO `users` (`RoleID`, `CourseID`, `FirstName`, `LastName`, `Email`, `Password`)
VALUES (3, 1, 'Nghia', 'Trung Doan', 'nghia.doan@student.swin.edu.au', 'password123');

-- Student 2: John
INSERT INTO `users` (`RoleID`, `CourseID`, `FirstName`, `LastName`, `Email`, `Password`)
VALUES (3, 1, 'John', 'Smith', 'john.smith@student.swin.edu.au', 'password123');

-- Student 3: Dung
INSERT INTO `users` (`RoleID`, `CourseID`, `FirstName`, `LastName`, `Email`, `Password`)
VALUES (3, 1, 'Dung', 'Tran Minh', 'dungcute@gmail.com', 'password123');

-- Student 4: Duc
INSERT INTO `users` (`RoleID`, `CourseID`, `FirstName`, `LastName`, `Email`, `Password`)
VALUES (3, 1, 'Duc', 'Luong Minh', 'ducbasubisu@gmail.com', '1');

-- Xem kết quả
SELECT u.UserID, u.FirstName, u.LastName, u.Email, r.Name as RoleName
FROM users u
INNER JOIN role r ON u.RoleID = r.RoleID
WHERE u.RoleID = 3;
