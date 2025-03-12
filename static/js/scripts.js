document.addEventListener("DOMContentLoaded", function () {
    // Modal Handling
    const modal = document.getElementById("class-modal");
    const addClassBtn = document.getElementById("add-class-btn");
    const closeModal = document.querySelector(".close-modal");

    if (modal && addClassBtn && closeModal) {
        addClassBtn.addEventListener("click", () => modal.style.display = "block");
        closeModal.addEventListener("click", () => modal.style.display = "none");
    }

    document.getElementById("upload-file-btn").addEventListener("click", function () {
        document.getElementById("upload-student-modal").style.display = "block";
    });
    
    document.getElementById("manual-entry-btn").addEventListener("click", function () {
        document.getElementById("manual-student-modal").style.display = "block";
    });
    
    // Close modals
    document.querySelectorAll(".close-modal").forEach(button => {
        button.addEventListener("click", function () {
            let modal = this.closest(".modal");
            if (modal) {
                modal.style.display = "none";
            }
        });
    });    
    
    // Upload File Event
    document.getElementById("upload-student-btn").addEventListener("click", function () {
        const fileInput = document.getElementById("student-file");
        if (fileInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const lines = e.target.result.split("\n").map(line => line.trim());
                updateStudentPreview(lines);
            };
            reader.readAsText(fileInput.files[0]);
        }
        document.getElementById("upload-student-modal").style.display = "none";
    });
    
    // Add Manual Student
    document.getElementById("add-manual-student").addEventListener("click", function () {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "manual-student";
        input.placeholder = "Last Name, First Name";
        document.getElementById("manual-student-list").appendChild(input);
    });
    
    // Close Manual Entry Modal & Update Preview
    document.getElementById("manual-student-modal").addEventListener("click", function (e) {
        if (e.target.classList.contains("close-modal")) {
            const manualInputs = document.querySelectorAll(".manual-student");
            const students = [...manualInputs].map(input => input.value.trim()).filter(v => v);
            updateStudentPreview(students);
        }
    });

    document.getElementById("create-class-btn").addEventListener("click", function () {
        const className = document.getElementById("class-name").value.trim();
        if (!className) {
            alert("Please enter a class name.");
            return;
        }
    
        const studentItems = document.querySelectorAll("#student-list-preview p");
        const students = [...studentItems].map(item => {
            const [lastName, firstName] = item.textContent.split(",").map(s => s.trim());
            return { last_name: lastName, first_name: firstName };
        });
    
        fetch("/create_class", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ class_name: className, students: students }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert("Class created successfully!");
                location.reload();
            } else {
                alert("Error creating class: " + data.error);
            }
        })
        .catch(error => console.error("Error:", error));
    });
    
    
    // Function to Update Student List Preview
    function updateStudentPreview(studentList) {
        const previewDiv = document.getElementById("student-list-preview");
        previewDiv.innerHTML = ""; // Clear previous content
        studentList.forEach(student => {
            let studentElem = document.createElement("p");
            studentElem.innerText = student;
            previewDiv.appendChild(studentElem);
        });
    }
});

document.addEventListener("DOMContentLoaded", function () {
    let currentClassId = null;
    let deletedStudents = new Set(); // Track deleted student IDs

    // Open Edit Modal and Fetch Class Data
    document.querySelectorAll(".edit-btn").forEach(button => {
        button.addEventListener("click", function () {
            currentClassId = this.getAttribute("data-id");
            deletedStudents.clear(); // Reset deleted students tracking

            fetch(`/get_class/${currentClassId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById("edit-class-name").value = data.class_name;
                        updateEditStudentList(data.students);
                        document.getElementById("edit-class-modal").style.display = "block";
                    } else {
                        alert("Error loading class data.");
                    }
                });
        });
    });

    // Update Student List in Edit Modal
    function updateEditStudentList(students) {
        const listDiv = document.getElementById("edit-student-list");
        listDiv.innerHTML = "";

        students.forEach(student => {
            const studentDiv = document.createElement("div");
            studentDiv.classList.add("student-item");
            studentDiv.setAttribute("data-student-id", student.id); // Store student ID
            studentDiv.innerHTML = `
                <span>${student.last_name}, ${student.first_name}</span>
                <button class="remove-student-btn" data-id="${student.id}">❌</button>
            `;
            listDiv.appendChild(studentDiv);

            // Remove student event listener
            studentDiv.querySelector(".remove-student-btn").addEventListener("click", function () {
                const studentId = this.getAttribute("data-id");
                if (studentId) deletedStudents.add(studentId); // Mark for deletion
                studentDiv.remove();
            });
        });
    }

    // Add New Student Manually
    document.getElementById("add-student-btn").addEventListener("click", function () {
        const input = document.getElementById("new-student").value.trim();
        if (!input.includes(",")) {
            alert("Use format: Last Name, First Name");
            return;
        }

        const [lastName, firstName] = input.split(",").map(s => s.trim());
        const studentDiv = document.createElement("div");
        studentDiv.classList.add("student-item");
        studentDiv.innerHTML = `
            <span>${lastName}, ${firstName}</span>
            <button class="remove-student-btn">❌</button>
        `;
        document.getElementById("edit-student-list").appendChild(studentDiv);

        // Add event listener for removal
        studentDiv.querySelector(".remove-student-btn").addEventListener("click", function () {
            studentDiv.remove();
        });

        document.getElementById("new-student").value = "";
    });

    // Save Changes in Edit Modal
    document.getElementById("save-edit-class").addEventListener("click", function () {
        const newName = document.getElementById("edit-class-name").value.trim();
        const studentItems = document.querySelectorAll("#edit-student-list .student-item");
        const updatedStudents = [];

        studentItems.forEach(studentDiv => {
            const studentId = studentDiv.getAttribute("data-student-id");
            const text = studentDiv.querySelector("span").textContent.trim();
            const [lastName, firstName] = text.split(",").map(s => s.trim());
            updatedStudents.push({ id: studentId || null, first_name: firstName, last_name: lastName });
        });

        fetch(`/edit_class/${currentClassId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                class_name: newName, 
                students: updatedStudents, 
                deleted_students: Array.from(deletedStudents) 
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert("Class updated successfully!");
                location.reload();
            } else {
                alert("Error updating class.");
            }
        });
    });

    // Delete Class
    document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", function () {
            const classId = this.getAttribute("data-id");
            if (confirm("Are you sure you want to delete this class?")) {
                fetch(`/delete_class/${classId}`, { method: "POST" })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert("Class deleted successfully!");
                        location.reload();
                    } else {
                        alert("Error deleting class.");
                    }
                });
            }
        });
    });

    document.querySelectorAll(".close-modal").forEach(button => {
        button.addEventListener("click", function () {
            let modal = this.closest(".modal");
            if (modal) {
                modal.style.display = "none";
            }
        });
    });    
});

document.addEventListener("DOMContentLoaded", async function () {
    const themeToggle = document.getElementById("theme-toggle");

    // Fetch the current theme from the database
    async function fetchTheme() {
        try {
            const response = await fetch("/get_theme");
            const data = await response.json();
            document.documentElement.setAttribute("data-theme", data.theme);
            themeToggle.textContent = data.theme === "dark" ? "☀️" : "🌙";
        } catch (error) {
            console.error("Failed to fetch theme:", error);
        }
    }

    // Update theme preference in the database
    async function updateTheme(newTheme) {
        try {
            await fetch("/set_theme", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme: newTheme })
            });
        } catch (error) {
            console.error("Failed to update theme:", error);
        }
    }

    // Toggle theme when clicked
    themeToggle.addEventListener("click", async function () {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", newTheme);
        themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";

        await updateTheme(newTheme);
    });

    // Apply theme on page load
    await fetchTheme();
});