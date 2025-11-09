plugins {
    kotlin("jvm") version "1.9.21"
    id("maven-publish")
}

group = "com.productdrivers"
version = "1.0.0"

repositories {
    mavenCentral()
    google()
}

dependencies {
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.21")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.10.1")
    
    // Android
    compileOnly("androidx.core:core-ktx:1.12.0")
    
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
}

kotlin {
    jvmToolchain(17)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            
            groupId = "com.productdrivers"
            artifactId = "sdk-kotlin"
            version = "1.0.0"
        }
    }
}

