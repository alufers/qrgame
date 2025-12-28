package main

import (
	"embed"
	"io/fs"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/static"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

//go:embed public/*
var embedDir embed.FS

type Scan struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ScannedAt time.Time `json:"scanned_at"`
	Username  string    `gorm:"index:idx_user_code,unique" json:"username"`
	Code      string    `gorm:"index:idx_user_code,unique" json:"code"`
}

func main() {
	db, err := gorm.Open(sqlite.Open("qrgame.db"), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	// Auto Migrate the schema
	db.AutoMigrate(&Scan{})

	app := fiber.New()

	if _, err := os.Stat("./public"); os.IsNotExist(err) {
		log.Println("Serving embedded assets")
		subFS, err := fs.Sub(embedDir, "public")
		if err != nil {
			log.Fatal(err)
		}
		app.Use("/", static.New("", static.Config{
			FS: subFS,
		}))
	} else {
		log.Println("Serving assets from ./public")
		app.Use("/", static.New("./public"))
	}

	app.Post("/api/scanned", func(c fiber.Ctx) error {
		var req struct {
			Username string `json:"username"`
			Code     string `json:"code"`
		}

		if err := c.Bind().JSON(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).SendString(err.Error())
		}

		if req.Username == "" || req.Code == "" {
			return c.Status(fiber.StatusBadRequest).SendString("Username and Code are required")
		}

		var existing Scan
		result := db.Where("username = ? AND code = ?", req.Username, req.Code).First(&existing)
		if result.Error == nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"message": "You have already scanned this code",
				"code":    "DUPLICATE_SCAN",
			})
		}

		scan := Scan{
			ScannedAt: time.Now(),
			Username:  req.Username,
			Code:      req.Code,
		}

		if err := db.Create(&scan).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("Failed to save scan")
		}

		var count int64
		db.Model(&Scan{}).Where("code = ?", req.Code).Count(&count)

		// Calculate user's rank
		type UserScanCount struct {
			Username string
			Count    int64
		}
		var userCounts []UserScanCount
		db.Model(&Scan{}).Select("username, count(*) as count").Group("username").Scan(&userCounts)

		myRank := 1
		var myCount int64
		for _, uc := range userCounts {
			if uc.Username == req.Username {
				myCount = uc.Count
				break
			}
		}

		for _, uc := range userCounts {
			if uc.Count > myCount {
				myRank++
			}
		}

		return c.JSON(fiber.Map{
			"message": "Scanned successfully",
			"count":   count,
			"rank":    myRank,
		})
	})

	app.Get("/api/players-leaderboard", func(c fiber.Ctx) error {
		type Result struct {
			Username string `json:"username"`
			Count    int    `json:"count"`
		}
		var results []Result
		db.Model(&Scan{}).Select("username, count(*) as count").Group("username").Order("count desc").Scan(&results)
		return c.JSON(results)
	})

	app.Get("/api/codes-leaderboard", func(c fiber.Ctx) error {
		type Result struct {
			Code  string `json:"code"`
			Count int    `json:"count"`
		}
		var results []Result
		db.Model(&Scan{}).Select("code, count(*) as count").Group("code").Order("count desc").Scan(&results)
		return c.JSON(results)
	})

	log.Fatal(app.Listen(":3000"))
}
